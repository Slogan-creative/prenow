begin;
-- Primo collaudo riservato al Super Admin. Nessun accesso pubblico ai clienti.
create or replace function public.prenow_test_catalog(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t uuid; result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Accesso non autorizzato'; end if;
 select id into t from public.tenants where slug=p_slug;
 if t is null then raise exception 'Salone non trovato'; end if;
 select jsonb_build_object('nome',nome,'services',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'durata',durata_min,'prezzo',prezzo_centesimi) order by ordine),'[]') from public.services where tenant_id=t and attivo),'operators',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nome',o.nome,'services',(select coalesce(jsonb_agg(service_id),'[]') from public.operator_services where operator_id=o.id)) order by o.nome),'[]') from public.operators o where tenant_id=t and attivo)) into result from public.tenants where id=t;
 return result;
end $$;

create or replace function public.prenow_test_slots(p_slug text,p_service uuid,p_operator uuid,p_date date)
returns table(start_at timestamptz) language plpgsql stable security definer set search_path='' as $$
declare t uuid; duration integer;
begin
 if not public.is_platform_admin() then raise exception 'Accesso non autorizzato'; end if;
 if p_date < (now() at time zone 'Europe/Rome')::date or p_date > (now() at time zone 'Europe/Rome')::date+60 then return; end if;
 select s.tenant_id,s.durata_min into t,duration from public.services s join public.tenants x on x.id=s.tenant_id join public.operators o on o.tenant_id=s.tenant_id and o.id=p_operator and o.attivo join public.operator_services os on os.operator_id=o.id and os.service_id=s.id where x.slug=p_slug and s.id=p_service and s.attivo;
 if t is null then return; end if;
 return query
 with schedule as (
 select h.* from public.business_hours h where h.tenant_id=t and h.weekday=extract(dow from p_date)::integer and (h.operator_id=p_operator or h.operator_id is null)
 order by (h.operator_id is not null) desc,h.id limit 1
 ), candidates as (
 select g as st,g+make_interval(mins=>duration) as en from schedule h cross join lateral jsonb_array_elements(h.fasce) f cross join lateral generate_series((p_date+(f->>'da')::time) at time zone 'Europe/Rome',((p_date+(f->>'a')::time) at time zone 'Europe/Rome')-make_interval(mins=>duration), interval '15 minutes') g where not h.chiuso
 )
 select distinct c.st from candidates c where c.st>now()
 and not exists(select 1 from public.appointments a where a.operator_id=p_operator and a.stato not in ('cancellato_cliente','cancellato_negozio') and a.start_at<c.en and a.end_at>c.st)
 and not exists(select 1 from public.closures b where b.tenant_id=t and p_date between b.data_inizio and b.data_fine and (b.tutto_il_giorno or (((p_date+b.ora_inizio) at time zone 'Europe/Rome')<c.en and ((p_date+b.ora_fine) at time zone 'Europe/Rome')>c.st)))
 and not exists(select 1 from public.operator_absences b where b.tenant_id=t and b.operator_id=p_operator and p_date between b.data_inizio and b.data_fine and (b.tutto_il_giorno or (((p_date+b.ora_inizio) at time zone 'Europe/Rome')<c.en and ((p_date+b.ora_fine) at time zone 'Europe/Rome')>c.st)))
 and not exists(select 1 from public.manual_blocks b where b.tenant_id=t and (b.operator_id=p_operator or b.operator_id is null) and b.data=p_date and ((p_date+b.ora_inizio) at time zone 'Europe/Rome')<c.en and ((p_date+b.ora_fine) at time zone 'Europe/Rome')>c.st)
 order by c.st;
end $$;

create or replace function public.prenow_test_book(p_slug text,p_service uuid,p_operator uuid,p_start timestamptz,p_nome text,p_cognome text,p_email text,p_telefono text)
returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid; duration integer; customer uuid; booking uuid;
begin
 if not public.is_platform_admin() then raise exception 'Accesso non autorizzato'; end if;
 if p_nome is null or p_cognome is null or p_email is null or p_telefono is null or length(trim(p_nome)) not between 1 and 120 or length(trim(p_cognome)) not between 1 and 120 or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_telefono !~ '^\+?[0-9 ()-]{6,25}$' then raise exception 'Controlla i dati del cliente'; end if;
 select s.tenant_id,s.durata_min into t,duration from public.services s join public.tenants x on x.id=s.tenant_id where x.slug=p_slug and s.id=p_service and s.attivo;
 if t is null then raise exception 'Servizio non disponibile'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operator::text,0));
 if not exists(select 1 from public.prenow_test_slots(p_slug,p_service,p_operator,(p_start at time zone 'Europe/Rome')::date) s where s.start_at=p_start) then raise exception 'Orario non più disponibile: scegli un altro orario'; end if;
 -- Il collaudo non sovrascrive le informazioni di clienti già esistenti.
 insert into public.customers(tenant_id,nome,cognome,email,telefono) values(t,trim(p_nome),trim(p_cognome),lower(trim(p_email)),trim(p_telefono)) on conflict(tenant_id,email) do nothing returning id into customer;
 if customer is null then select id into customer from public.customers where tenant_id=t and email=lower(trim(p_email)); end if;
 insert into public.appointments(tenant_id,customer_id,operator_id,service_id,start_at,end_at,created_by_staff,note) values(t,customer,p_operator,p_service,p_start,p_start+make_interval(mins=>duration),true,'Collaudo Prenow') returning id into booking;
 return booking;
end $$;
revoke all on function public.prenow_test_catalog(text) from public,anon;
revoke all on function public.prenow_test_slots(text,uuid,uuid,date) from public,anon;
revoke all on function public.prenow_test_book(text,uuid,uuid,timestamptz,text,text,text,text) from public,anon;
grant execute on function public.prenow_test_catalog(text) to authenticated;
grant execute on function public.prenow_test_slots(text,uuid,uuid,date) to authenticated;
grant execute on function public.prenow_test_book(text,uuid,uuid,timestamptz,text,text,text,text) to authenticated;
commit;
