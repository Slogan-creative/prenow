begin;
create or replace function public.prenow_customer_catalog(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t uuid; result jsonb;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
 select id into t from public.tenants where slug=p_slug;
 if t is null then raise exception 'Salone non trovato'; end if;
 select jsonb_build_object('nome',nome,'services',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'durata',durata_min,'prezzo',prezzo_centesimi) order by ordine),'[]') from public.services where tenant_id=t and attivo),'operators',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nome',o.nome,'services',(select coalesce(jsonb_agg(service_id),'[]') from public.operator_services where operator_id=o.id)) order by o.nome),'[]') from public.operators o where tenant_id=t and attivo)) into result from public.tenants where id=t;
 return result;
end $$;

create or replace function public.prenow_customer_slots(p_slug text,p_service uuid,p_operator uuid,p_date date)
returns table(start_at timestamptz) language plpgsql stable security definer set search_path='' as $$
declare t uuid; duration integer;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
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

create or replace function public.prenow_customer_book(p_slug text,p_service uuid,p_operator uuid,p_start timestamptz,p_nome text,p_cognome text,p_telefono text)
returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid; duration integer; customer uuid; booking uuid; v_email text; u uuid;
begin
 u:=auth.uid(); if u is null then raise exception 'Accedi per prenotare'; end if;
 select lower(a.email) into v_email from auth.users a where a.id=u and a.email_confirmed_at is not null;
 if v_email is null then raise exception 'Conferma la tua email prima di prenotare'; end if;
 if p_nome is null or p_cognome is null or p_telefono is null or length(trim(p_nome)) not between 1 and 120 or length(trim(p_cognome)) not between 1 and 120 or p_telefono !~ '^\+?[0-9 ()-]{6,25}$' then raise exception 'Controlla nome, cognome e cellulare'; end if;
 select s.tenant_id,s.durata_min into t,duration from public.services s join public.tenants x on x.id=s.tenant_id where x.slug=p_slug and s.id=p_service and s.attivo;
 if t is null then raise exception 'Servizio non disponibile'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operator::text,0));
 if not exists(select 1 from public.prenow_customer_slots(p_slug,p_service,p_operator,(p_start at time zone 'Europe/Rome')::date) s where s.start_at=p_start) then raise exception 'Orario non più disponibile'; end if;
 -- Nessun collegamento automatico di profili già presenti in base alla sola email.
 select c.id into customer from public.customers c where c.tenant_id=t and c.user_id=u order by c.created_at limit 1;
 if customer is null then
  if exists(select 1 from public.customers c where c.tenant_id=t and lower(c.email)=v_email) then raise exception 'Profilo già presente: contatta il salone per collegare il tuo account'; end if;
  insert into public.customers(tenant_id,user_id,nome,cognome,email,telefono) values(t,u,trim(p_nome),trim(p_cognome),v_email,trim(p_telefono)) returning id into customer;
 else
  update public.customers set nome=trim(p_nome),cognome=trim(p_cognome),telefono=trim(p_telefono) where id=customer and user_id=u;
 end if;
 insert into public.appointments(tenant_id,customer_id,operator_id,service_id,start_at,end_at) values(t,customer,p_operator,p_service,p_start,p_start+make_interval(mins=>duration)) returning id into booking;
 return booking;
end $$;
create or replace function public.prenow_customer_appointments(p_slug text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'start',a.start_at,'end',a.end_at,'stato',a.stato,'service',s.nome,'operator',o.nome) order by a.start_at desc),'[]') into result from public.appointments a join public.customers c on c.id=a.customer_id and c.tenant_id=a.tenant_id join public.tenants t on t.id=a.tenant_id join public.services s on s.id=a.service_id join public.operators o on o.id=a.operator_id where c.user_id=auth.uid() and t.slug=p_slug;
 return result;
end $$;
create or replace function public.prenow_customer_cancel(p_slug text,p_booking uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
 update public.appointments a set stato='cancellato_cliente',updated_at=now() from public.customers c,public.tenants t where a.id=p_booking and a.customer_id=c.id and c.tenant_id=a.tenant_id and t.id=a.tenant_id and t.slug=p_slug and c.user_id=auth.uid() and a.stato='confermato' and a.start_at>now();
 return found;
end $$;
revoke all on function public.prenow_customer_catalog(text) from public,anon;
revoke all on function public.prenow_customer_slots(text,uuid,uuid,date) from public,anon;
revoke all on function public.prenow_customer_book(text,uuid,uuid,timestamptz,text,text,text) from public,anon;
revoke all on function public.prenow_customer_appointments(text) from public,anon;
revoke all on function public.prenow_customer_cancel(text,uuid) from public,anon;
grant execute on function public.prenow_customer_catalog(text) to authenticated;
grant execute on function public.prenow_customer_slots(text,uuid,uuid,date) to authenticated;
grant execute on function public.prenow_customer_book(text,uuid,uuid,timestamptz,text,text,text) to authenticated;
grant execute on function public.prenow_customer_appointments(text) to authenticated;
grant execute on function public.prenow_customer_cancel(text,uuid) to authenticated;
commit;
