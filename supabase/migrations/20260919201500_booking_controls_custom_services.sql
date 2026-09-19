-- Booking controls and one-off custom services
alter table public.appointments
  alter column service_id drop not null,
  add column if not exists custom_service_name text,
  add column if not exists custom_duration_min integer,
  add column if not exists custom_price_cents integer;

alter table public.appointments drop constraint if exists appointments_service_mode_check;
alter table public.appointments add constraint appointments_service_mode_check check (
  (
    service_id is not null
    and custom_service_name is null
    and custom_duration_min is null
    and custom_price_cents is null
  )
  or
  (
    service_id is null
    and length(trim(custom_service_name)) between 1 and 120
    and custom_duration_min between 5 and 480
    and custom_price_cents >= 0
  )
);

create or replace function public.prenow_owner_set_customer_bookings(p_slug text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare ctx jsonb; t uuid; r text;
begin
  ctx:=public.prenow_owner_context(p_slug);
  t:=(ctx->>'tenant_id')::uuid;
  r:=ctx->>'role';
  if r not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato'; end if;
  insert into public.tenant_features(tenant_id,feature_key,enabled)
  values(t,'customer_booking',coalesce(p_enabled,false))
  on conflict (tenant_id,feature_key) do update set enabled=excluded.enabled;
end
$function$;

revoke all on function public.prenow_owner_set_customer_bookings(text,boolean) from public;
grant execute on function public.prenow_owner_set_customer_bookings(text,boolean) to authenticated;

create or replace function public.prenow_customer_catalog(p_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare t uuid; result jsonb; booking_enabled boolean;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
 select id into t from public.tenants where slug=p_slug;
 if t is null then raise exception 'Salone non trovato'; end if;
 select coalesce((select enabled from public.tenant_features where tenant_id=t and feature_key='customer_booking'),true) into booking_enabled;
 select jsonb_build_object(
   'nome',nome,
   'booking_enabled',booking_enabled,
   'services',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'durata',durata_min,'prezzo',prezzo_centesimi) order by ordine),'[]') from public.services where tenant_id=t and attivo),
   'operators',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nome',o.nome,'services',(select coalesce(jsonb_agg(service_id),'[]') from public.operator_services where operator_id=o.id)) order by o.nome),'[]') from public.operators o where tenant_id=t and attivo)
 ) into result from public.tenants where id=t;
 return result;
end
$function$;

create or replace function public.prenow_customer_book(p_slug text, p_service uuid, p_operator uuid, p_start timestamptz, p_nome text, p_cognome text, p_telefono text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare t uuid; duration integer; customer uuid; booking uuid; v_email text; u uuid;
begin
 u:=auth.uid(); if u is null then raise exception 'Accedi per prenotare'; end if;
 select lower(a.email) into v_email from auth.users a where a.id=u and a.email_confirmed_at is not null;
 if v_email is null then raise exception 'Conferma la tua email prima di prenotare'; end if;
 if p_nome is null or p_cognome is null or p_telefono is null or length(trim(p_nome)) not between 1 and 120 or length(trim(p_cognome)) not between 1 and 120 or p_telefono !~ '^\\+?[0-9 ()-]{6,25}$' then raise exception 'Controlla nome, cognome e cellulare'; end if;
 select s.tenant_id,s.durata_min into t,duration from public.services s join public.tenants x on x.id=s.tenant_id where x.slug=p_slug and s.id=p_service and s.attivo;
 if t is null then raise exception 'Servizio non disponibile'; end if;
 if exists(select 1 from public.tenant_features where tenant_id=t and feature_key='customer_booking' and enabled=false) then raise exception 'Prenotazioni online sospese'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operator::text,0));
 if not exists(select 1 from public.prenow_customer_slots(p_slug,p_service,p_operator,(p_start at time zone 'Europe/Rome')::date) s where s.start_at=p_start) then raise exception 'Orario non più disponibile'; end if;
 select c.id into customer from public.customers c where c.tenant_id=t and c.user_id=u order by c.created_at limit 1;
 if customer is null then
  if exists(select 1 from public.customers c where c.tenant_id=t and lower(c.email)=v_email) then raise exception 'Profilo già presente: contatta il salone per collegare il tuo account'; end if;
  insert into public.customers(tenant_id,user_id,nome,cognome,email,telefono) values(t,u,trim(p_nome),trim(p_cognome),v_email,trim(p_telefono)) returning id into customer;
 else
  update public.customers set nome=trim(p_nome),cognome=trim(p_cognome),telefono=trim(p_telefono) where id=customer and user_id=u;
 end if;
 insert into public.appointments(tenant_id,customer_id,operator_id,service_id,start_at,end_at) values(t,customer,p_operator,p_service,p_start,p_start+make_interval(mins=>duration)) returning id into booking;
 return booking;
end
$function$;

create or replace function public.prenow_customer_book_guest(p_slug text, p_service uuid, p_operator uuid, p_start timestamptz, p_nome text, p_cognome text, p_email text, p_telefono text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare t uuid; duration integer; customer uuid; booking uuid; v_email text; u uuid;
begin
 u:=auth.uid();
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) is not true then raise exception 'Sessione ospite non valida'; end if;
 v_email:=lower(trim(coalesce(p_email,'')));
 if length(v_email) not between 5 and 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$' then raise exception 'Controlla l''indirizzo email'; end if;
 if p_nome is null or p_cognome is null or p_telefono is null or length(trim(p_nome)) not between 1 and 120 or length(trim(p_cognome)) not between 1 and 120 or p_telefono !~ '^\\+?[0-9 ()-]{6,25}$' then raise exception 'Controlla nome, cognome e cellulare'; end if;
 select s.tenant_id,s.durata_min into t,duration from public.services s join public.tenants x on x.id=s.tenant_id where x.slug=p_slug and s.id=p_service and s.attivo;
 if t is null then raise exception 'Servizio non disponibile'; end if;
 if exists(select 1 from public.tenant_features where tenant_id=t and feature_key='customer_booking' and enabled=false) then raise exception 'Prenotazioni online sospese'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operator::text,0));
 if not exists(select 1 from public.prenow_customer_slots(p_slug,p_service,p_operator,(p_start at time zone 'Europe/Rome')::date) s where s.start_at=p_start) then raise exception 'Orario non più disponibile'; end if;
 select c.id into customer from public.customers c where c.tenant_id=t and c.user_id=u order by c.created_at limit 1;
 if customer is null then
  if exists(select 1 from public.customers c where c.tenant_id=t and lower(c.email)=v_email) then raise exception 'Email già associata a un profilo: accedi prima di prenotare'; end if;
  insert into public.customers(tenant_id,user_id,nome,cognome,email,telefono) values(t,u,trim(p_nome),trim(p_cognome),v_email,trim(p_telefono)) returning id into customer;
 else
  update public.customers set nome=trim(p_nome),cognome=trim(p_cognome),email=v_email,telefono=trim(p_telefono) where id=customer and user_id=u;
 end if;
 insert into public.appointments(tenant_id,customer_id,operator_id,service_id,start_at,end_at) values(t,customer,p_operator,p_service,p_start,p_start+make_interval(mins=>duration)) returning id into booking;
 return booking;
end
$function$;

create or replace function public.prenow_staff_slots_custom(p_tenant uuid, p_operator uuid, p_date date, p_duration integer)
returns table(start_at timestamptz)
language plpgsql
stable security definer
set search_path to ''
as $function$
declare member_role text;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
 if not coalesce(public.is_platform_admin(),false) then
   select ruolo into member_role from public.tenant_users where tenant_id=p_tenant and user_id=auth.uid() and attivo=true;
   if member_role is null or member_role not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato'; end if;
 end if;
 if p_duration not between 5 and 480 then raise exception 'Durata non valida'; end if;
 if p_date < (now() at time zone 'Europe/Rome')::date or p_date > (now() at time zone 'Europe/Rome')::date+60 then return; end if;
 if not exists(select 1 from public.operators where id=p_operator and tenant_id=p_tenant and attivo=true) then return; end if;
 return query
 with schedule as (
   select h.* from public.business_hours h
   where h.tenant_id=p_tenant and h.weekday=extract(dow from p_date)::integer and (h.operator_id=p_operator or h.operator_id is null)
   order by (h.operator_id is not null) desc,h.id limit 1
 ), candidates as (
   select g as st,g+make_interval(mins=>p_duration) as en
   from schedule h
   cross join lateral jsonb_array_elements(h.fasce) f
   cross join lateral generate_series(
     (p_date+(f->>'da')::time) at time zone 'Europe/Rome',
     ((p_date+(f->>'a')::time) at time zone 'Europe/Rome')-make_interval(mins=>p_duration),
     interval '15 minutes'
   ) g
   where not h.chiuso
 )
 select distinct c.st from candidates c
 where c.st>now()
 and not exists(select 1 from public.appointments a where a.operator_id=p_operator and a.stato not in ('cancellato_cliente','cancellato_negozio') and a.start_at<c.en and a.end_at>c.st)
 and not exists(select 1 from public.closures b where b.tenant_id=p_tenant and p_date between b.data_inizio and b.data_fine and (b.tutto_il_giorno or (((p_date+b.ora_inizio) at time zone 'Europe/Rome')<c.en and ((p_date+b.ora_fine) at time zone 'Europe/Rome')>c.st)))
 and not exists(select 1 from public.operator_absences b where b.tenant_id=p_tenant and b.operator_id=p_operator and p_date between b.data_inizio and b.data_fine and (b.tutto_il_giorno or (((p_date+b.ora_inizio) at time zone 'Europe/Rome')<c.en and ((p_date+b.ora_fine) at time zone 'Europe/Rome')>c.st)))
 and not exists(select 1 from public.manual_blocks b where b.tenant_id=p_tenant and (b.operator_id=p_operator or b.operator_id is null) and b.data=p_date and ((p_date+b.ora_inizio) at time zone 'Europe/Rome')<c.en and ((p_date+b.ora_fine) at time zone 'Europe/Rome')>c.st)
 order by c.st;
end
$function$;

revoke all on function public.prenow_staff_slots_custom(uuid,uuid,date,integer) from public;
grant execute on function public.prenow_staff_slots_custom(uuid,uuid,date,integer) to authenticated;

create or replace function public.prenow_staff_book_custom(p_tenant uuid, p_operator uuid, p_start timestamptz, p_customer uuid, p_note text, p_service_name text, p_duration integer, p_price_cents integer)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare result uuid; member_role text;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
 if not coalesce(public.is_platform_admin(),false) then
   select ruolo into member_role from public.tenant_users where tenant_id=p_tenant and user_id=auth.uid() and attivo=true;
   if member_role is null or member_role not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato'; end if;
 end if;
 if p_start is null or p_customer is null or length(coalesce(p_note,''))>1000 then raise exception 'Dati non validi'; end if;
 if length(trim(coalesce(p_service_name,''))) not between 1 and 120 or p_duration not between 5 and 480 or p_price_cents is null or p_price_cents<0 then raise exception 'Servizio personalizzato non valido'; end if;
 if not exists(select 1 from public.customers where id=p_customer and tenant_id=p_tenant) then raise exception 'Cliente non appartenente al salone'; end if;
 if not exists(select 1 from public.operators where id=p_operator and tenant_id=p_tenant and attivo=true) then raise exception 'Operatore non disponibile'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operator::text,0));
 if not exists(select 1 from public.prenow_staff_slots_custom(p_tenant,p_operator,(p_start at time zone 'Europe/Rome')::date,p_duration) a where a.start_at=p_start) then raise exception 'Orario non disponibile'; end if;
 insert into public.appointments(tenant_id,customer_id,service_id,operator_id,start_at,end_at,stato,note,created_by_staff,custom_service_name,custom_duration_min,custom_price_cents)
 values(p_tenant,p_customer,null,p_operator,p_start,p_start+make_interval(mins=>p_duration),'confermato',nullif(trim(p_note),''),true,trim(p_service_name),p_duration,p_price_cents)
 returning id into result;
 return result;
end
$function$;

revoke all on function public.prenow_staff_book_custom(uuid,uuid,timestamptz,uuid,text,text,integer,integer) from public;
grant execute on function public.prenow_staff_book_custom(uuid,uuid,timestamptz,uuid,text,text,integer,integer) to authenticated;

create or replace function public.prenow_customer_appointments(p_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'start',a.start_at,'end',a.end_at,'stato',a.stato,'service',coalesce(a.custom_service_name,s.nome),'operator',o.nome) order by a.start_at desc),'[]')
 into result
 from public.appointments a
 join public.customers c on c.id=a.customer_id and c.tenant_id=a.tenant_id
 join public.tenants t on t.id=a.tenant_id
 left join public.services s on s.id=a.service_id
 join public.operators o on o.id=a.operator_id
 where c.user_id=auth.uid() and t.slug=p_slug;
 return result;
end
$function$;

create or replace function public.prenow_staff_agenda(p_slug text, p_date date)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare ctx jsonb;t uuid;title text;role_name text;own_operator uuid;
begin
 ctx:=public.prenow_owner_context(p_slug);t:=(ctx->>'tenant_id')::uuid;role_name:=ctx->>'role';own_operator:=nullif(ctx->>'operator_id','')::uuid;select nome into title from public.tenants where id=t;
 return jsonb_build_object('nome',title,'role',role_name,'appointments',coalesce((
   select jsonb_agg(jsonb_build_object('id',a.id,'start_at',a.start_at,'end_at',a.end_at,'stato',a.stato,'operator_id',a.operator_id,'customer',c.nome||' '||coalesce(c.cognome,''),'operator',o.nome,'service',coalesce(a.custom_service_name,s.nome)) order by a.start_at)
   from public.appointments a
   join public.customers c on c.id=a.customer_id and c.tenant_id=t
   join public.operators o on o.id=a.operator_id and o.tenant_id=t
   left join public.services s on s.id=a.service_id and s.tenant_id=t
   where a.tenant_id=t and (a.start_at at time zone 'Europe/Rome')::date=p_date and (role_name<>'operator' or a.operator_id=own_operator)
 ),'[]'::jsonb));
end
$function$;

create or replace function public.prenow_owner_dashboard(p_slug text, p_date date)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare ctx jsonb;t uuid;r text;op uuid;result jsonb;
begin
 ctx:=public.prenow_owner_context(p_slug);t:=(ctx->>'tenant_id')::uuid;r:=ctx->>'role';op:=nullif(ctx->>'operator_id','')::uuid;
 select jsonb_build_object(
  'today_count',(select count(*) from public.appointments where tenant_id=t and (start_at at time zone 'Europe/Rome')::date=p_date and stato='confermato' and (r<>'operator' or operator_id=op)),
  'upcoming_count',(select count(*) from public.appointments where tenant_id=t and start_at>=now() and stato='confermato' and (r<>'operator' or operator_id=op)),
  'customers_count',case when r='operator' then null else (select count(*) from public.customers where tenant_id=t) end,
  'active_services',(select count(*) from public.services where tenant_id=t and attivo),
  'next',coalesce((select jsonb_agg(x) from (
    select a.id,a.start_at,c.nome||' '||coalesce(c.cognome,'') customer,o.nome operator,coalesce(a.custom_service_name,s.nome) service
    from public.appointments a
    join public.customers c on c.id=a.customer_id
    join public.operators o on o.id=a.operator_id
    left join public.services s on s.id=a.service_id
    where a.tenant_id=t and (a.start_at at time zone 'Europe/Rome')::date=p_date and a.stato='confermato' and (r<>'operator' or a.operator_id=op)
    order by a.start_at limit 8
  )x),'[]'::jsonb)
 ) into result;
 return result;
end
$function$;
