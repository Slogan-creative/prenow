begin;

create or replace function public.prenow_manage_resource(
  p_tenant uuid,
  p_kind text,
  p_id uuid,
  p_name text,
  p_active boolean,
  p_duration integer,
  p_price integer,
  p_services uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_services uuid[] := coalesce(p_services, array[]::uuid[]);
begin
  if auth.uid() is null
     or not coalesce(public.is_platform_admin(), false) then
    raise exception 'Accesso non autorizzato';
  end if;

  -- Serializza i salvataggi di configurazione dello stesso tenant.
  perform 1 from public.tenants where id = p_tenant for update;
  if not found then
    raise exception 'Applicazione non trovata';
  end if;

  if p_name is null
     or length(trim(p_name)) not between 1 and 120
     or p_active is null then
    raise exception 'Dati non validi';
  end if;

  if p_kind = 'service' then
    if p_duration is null
       or p_duration not between 15 and 1440
       or p_duration % 15 <> 0
       or (p_price is not null
           and p_price not between 0 and 10000000) then
      raise exception 'Durata o prezzo non validi';
    end if;

    if p_id is null then
      insert into public.services(
        tenant_id, nome, durata_min, prezzo_centesimi, attivo
      )
      values(
        p_tenant, trim(p_name), p_duration, p_price, p_active
      )
      returning id into v_id;
    else
      update public.services
      set nome = trim(p_name),
          durata_min = p_duration,
          prezzo_centesimi = p_price,
          attivo = p_active
      where id = p_id and tenant_id = p_tenant
      returning id into v_id;

      if not found then
        raise exception 'Servizio non trovato';
      end if;
    end if;

  elsif p_kind = 'operator' then
    -- Impedisce associazioni con servizi di altre applicazioni.
    if exists(
      select 1
      from unnest(v_services) as selected(service_id)
      where selected.service_id is null
         or not exists(
           select 1 from public.services s
           where s.id = selected.service_id
             and s.tenant_id = p_tenant
         )
    ) then
      raise exception 'Associazione servizio non valida';
    end if;

    if p_id is null then
      insert into public.operators(tenant_id, nome, attivo)
      values(p_tenant, trim(p_name), p_active)
      returning id into v_id;
    else
      update public.operators
      set nome = trim(p_name), attivo = p_active
      where id = p_id and tenant_id = p_tenant
      returning id into v_id;

      if not found then
        raise exception 'Operatore non trovato';
      end if;
    end if;

    -- Aggiorna solo le associazioni; conserva gli appuntamenti.
    delete from public.operator_services
    where operator_id = v_id
      and not (service_id = any(v_services));

    insert into public.operator_services(operator_id, service_id)
    select v_id, selected.service_id
    from (
      select distinct unnest(v_services) as service_id
    ) selected
    on conflict(operator_id, service_id) do nothing;

  else
    raise exception 'Tipo risorsa non valido';
  end if;

  return v_id;
end;
$$;

revoke all on function public.prenow_manage_resource(
  uuid, text, uuid, text, boolean, integer, integer, uuid[]
) from public, anon;

grant execute on function public.prenow_manage_resource(
  uuid, text, uuid, text, boolean, integer, integer, uuid[]
) to authenticated;

commit;
