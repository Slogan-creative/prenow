create or replace function public.prenow_staff_agenda_range(
  p_slug text,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  ctx jsonb;
  t uuid;
  title text;
  role_name text;
  own_operator uuid;
begin
  if p_start is null or p_end is null or p_end < p_start or p_end > p_start + 366 then
    raise exception 'Intervallo agenda non valido';
  end if;

  ctx:=public.prenow_owner_context(p_slug);
  t:=(ctx->>'tenant_id')::uuid;
  role_name:=ctx->>'role';
  own_operator:=nullif(ctx->>'operator_id','')::uuid;
  select nome into title from public.tenants where id=t;

  return jsonb_build_object(
    'nome',title,
    'role',role_name,
    'appointments',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',a.id,
          'start_at',a.start_at,
          'end_at',a.end_at,
          'stato',a.stato,
          'operator_id',a.operator_id,
          'customer',c.nome||' '||coalesce(c.cognome,''),
          'operator',o.nome,
          'service',coalesce(a.custom_service_name,s.nome),
          'series_id',a.series_id,
          'occurrence_number',a.occurrence_number
        )
        order by a.start_at
      )
      from public.appointments a
      join public.customers c on c.id=a.customer_id and c.tenant_id=t
      join public.operators o on o.id=a.operator_id and o.tenant_id=t
      left join public.services s on s.id=a.service_id and s.tenant_id=t
      where a.tenant_id=t
        and (a.start_at at time zone 'Europe/Rome')::date between p_start and p_end
        and (role_name<>'operator' or a.operator_id=own_operator)
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.prenow_staff_agenda_range(text,date,date) from public, anon;
grant execute on function public.prenow_staff_agenda_range(text,date,date) to authenticated;
