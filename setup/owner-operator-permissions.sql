begin;

alter table public.tenant_users add column if not exists attivo boolean not null default true;
alter table public.tenant_users drop constraint if exists tenant_users_ruolo_check;
alter table public.tenant_users add constraint tenant_users_ruolo_check check (ruolo in ('tenant_admin','staff','operator'));
create unique index if not exists tenant_users_tenant_email_key on public.tenant_users(tenant_id,lower(email)) where email is not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='tenant_users_operator_id_fkey') then
  alter table public.tenant_users add constraint tenant_users_operator_id_fkey foreign key(operator_id) references public.operators(id) on delete set null;
 end if;
end $$;

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create or replace function private.link_pending_tenant_users() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email is not null then update public.tenant_users set user_id=new.id where user_id is null and lower(email)=lower(new.email); end if;
 return new;
end $$;
revoke all on function private.link_pending_tenant_users() from public,anon,authenticated;
drop trigger if exists prenow_link_pending_tenant_users on auth.users;
create trigger prenow_link_pending_tenant_users after insert or update of email on auth.users for each row execute function private.link_pending_tenant_users();

create or replace function public.prenow_owner_context(p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t uuid;n text;r text;op uuid;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Accesso non autorizzato';end if;
 select id,nome into t,n from public.tenants where slug=p_slug;
 if t is null then raise exception 'Attività non disponibile';end if;
 if coalesce(public.is_platform_admin(),false) then r:='tenant_admin'; else select ruolo,operator_id into r,op from public.tenant_users where tenant_id=t and user_id=auth.uid() and attivo=true; end if;
 if r is null or r not in ('tenant_admin','staff','operator') then raise exception 'Accesso non autorizzato';end if;
 if r='operator' and op is null then raise exception 'Operatore non collegato';end if;
 return jsonb_build_object('tenant_id',t,'nome',n,'slug',p_slug,'role',r,'operator_id',op);
end $$;
revoke all on function public.prenow_owner_context(text) from public,anon;
grant execute on function public.prenow_owner_context(text) to authenticated;

create or replace function public.prenow_owner_staff(p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $
declare ctx jsonb;t uuid;
begin
 ctx:=public.prenow_owner_context(p_slug);
 if ctx->>'role' not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato';end if;
 t:=(ctx->>'tenant_id')::uuid;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',o.id,'operator_id',o.id,'membership_id',tu.id,'user_id',tu.user_id,
  'nome',o.nome,'cognome',o.cognome,'email',coalesce(tu.email,o.email),'telefono',coalesce(tu.telefono,o.telefono),
  'ruolo',coalesce(tu.ruolo,'operator'),'attivo',o.attivo and coalesce(tu.attivo,true),
  'services',coalesce((select jsonb_agg(os.service_id) from public.operator_services os where os.operator_id=o.id),'[]'::jsonb),
  'absence_count',(select count(*) from public.operator_absences oa where oa.operator_id=o.id and oa.data_fine>=current_date)
 ) order by o.nome,o.cognome) from public.operators o left join public.tenant_users tu on tu.tenant_id=t and tu.operator_id=o.id where o.tenant_id=t),'[]'::jsonb);
end $;
revoke all on function public.prenow_owner_staff(text) from public,anon;
grant execute on function public.prenow_owner_staff(text) to authenticated;

create or replace function public.prenow_owner_manage_staff(p_slug text,p_membership_id uuid,p_operator_id uuid,p_name text,p_surname text,p_email text,p_phone text,p_role text,p_active boolean,p_services uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare ctx jsonb;t uuid;mid uuid;oid uuid;uid uuid;normalized_email text;service_ids uuid[]:=coalesce(p_services,array[]::uuid[]);
begin
 ctx:=public.prenow_owner_context(p_slug);
 if ctx->>'role' not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato';end if;
 t:=(ctx->>'tenant_id')::uuid; normalized_email:=nullif(lower(trim(coalesce(p_email,''))),'');
 if length(trim(coalesce(p_name,''))) not between 1 and 120 or (normalized_email is not null and normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+ raise exception 'Dati non validi';end if;
 if exists(select 1 from unnest(service_ids) x where not exists(select 1 from public.services s where s.id=x and s.tenant_id=t)) then raise exception 'Servizio non valido';end if;
 if normalized_email is not null then select id into uid from auth.users where lower(email)=normalized_email limit 1; end if; oid:=p_operator_id;
 if oid is null then
  insert into public.operators(tenant_id,nome,cognome,email,telefono,attivo) values(t,trim(p_name),nullif(trim(coalesce(p_surname,'')),''),normalized_email,nullif(trim(coalesce(p_phone,'')),''),p_active) returning id into oid;
 else
  update public.operators set nome=trim(p_name),cognome=nullif(trim(coalesce(p_surname,'')),''),email=normalized_email,telefono=nullif(trim(coalesce(p_phone,'')),''),attivo=p_active,updated_at=now() where id=oid and tenant_id=t;
  if not found then raise exception 'Operatore non trovato';end if;
 end if;
 if p_membership_id is null then
  insert into public.tenant_users(tenant_id,user_id,ruolo,nome,cognome,email,telefono,operator_id,attivo) values(t,uid,p_role,trim(p_name),nullif(trim(coalesce(p_surname,'')),''),normalized_email,nullif(trim(coalesce(p_phone,'')),''),oid,p_active) returning id into mid;
 else
  if exists(select 1 from public.tenant_users where id=p_membership_id and tenant_id=t and user_id=auth.uid()) then raise exception 'Non puoi modificare il tuo accesso';end if;
  update public.tenant_users set user_id=coalesce(user_id,uid),ruolo=p_role,nome=trim(p_name),cognome=nullif(trim(coalesce(p_surname,'')),''),email=normalized_email,telefono=nullif(trim(coalesce(p_phone,'')),''),operator_id=oid,attivo=p_active where id=p_membership_id and tenant_id=t returning id into mid;
  if mid is null then raise exception 'Collaboratore non trovato';end if;
 end if;
 delete from public.operator_services where operator_id=oid;
 insert into public.operator_services(operator_id,service_id) select oid,x from unnest(service_ids) x on conflict do nothing;
 return oid;
end $;
revoke all on function public.prenow_owner_manage_staff(text,uuid,uuid,text,text,text,text,text,boolean,uuid[]) from public,anon;
grant execute on function public.prenow_owner_manage_staff(text,uuid,uuid,text,text,text,text,text,boolean,uuid[]) to authenticated;

create or replace function public.prenow_staff_agenda(p_slug text,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb;t uuid;title text;role_name text;own_operator uuid;
begin
 ctx:=public.prenow_owner_context(p_slug);t:=(ctx->>'tenant_id')::uuid;role_name:=ctx->>'role';own_operator:=nullif(ctx->>'operator_id','')::uuid;
 select nome into title from public.tenants where id=t;
 return jsonb_build_object('nome',title,'role',role_name,'appointments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'start_at',a.start_at,'end_at',a.end_at,'stato',a.stato,'operator_id',a.operator_id,'customer',c.nome||' '||coalesce(c.cognome,''),'operator',o.nome,'service',s.nome) order by a.start_at) from public.appointments a join public.customers c on c.id=a.customer_id and c.tenant_id=t join public.operators o on o.id=a.operator_id and o.tenant_id=t join public.services s on s.id=a.service_id and s.tenant_id=t where a.tenant_id=t and (a.start_at at time zone 'Europe/Rome')::date=p_date and (role_name<>'operator' or a.operator_id=own_operator)),'[]'::jsonb));
end $$;

create or replace function public.prenow_owner_dashboard(p_slug text,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb;t uuid;r text;op uuid;result jsonb;
begin
 ctx:=public.prenow_owner_context(p_slug);t:=(ctx->>'tenant_id')::uuid;r:=ctx->>'role';op:=nullif(ctx->>'operator_id','')::uuid;
 select jsonb_build_object('today_count',(select count(*) from public.appointments where tenant_id=t and (start_at at time zone 'Europe/Rome')::date=p_date and stato='confermato' and (r<>'operator' or operator_id=op)),'upcoming_count',(select count(*) from public.appointments where tenant_id=t and start_at>=now() and stato='confermato' and (r<>'operator' or operator_id=op)),'customers_count',case when r='operator' then null else (select count(*) from public.customers where tenant_id=t) end,'active_services',(select count(*) from public.services where tenant_id=t and attivo),'next',coalesce((select jsonb_agg(x) from (select a.id,a.start_at,c.nome||' '||coalesce(c.cognome,'') customer,o.nome operator,s.nome service from public.appointments a join public.customers c on c.id=a.customer_id join public.operators o on o.id=a.operator_id join public.services s on s.id=a.service_id where a.tenant_id=t and (a.start_at at time zone 'Europe/Rome')::date=p_date and a.stato='confermato' and (r<>'operator' or a.operator_id=op) order by a.start_at limit 8)x),'[]'::jsonb)) into result;
 return result;
end $$;


create or replace function public.prenow_owner_save_hours(p_slug text,p_operator uuid,p_weekday integer,p_closed boolean,p_ranges jsonb)
returns void language plpgsql security definer set search_path='' as $
declare ctx jsonb;t uuid;
begin
 ctx:=public.prenow_owner_context(p_slug);
 if ctx->>'role' not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato';end if;
 t:=(ctx->>'tenant_id')::uuid;
 if p_weekday not between 0 and 6 or p_closed is null or jsonb_typeof(coalesce(p_ranges,'[]'::jsonb))<>'array' then raise exception 'Dati non validi';end if;
 perform 1 from public.operators where id=p_operator and tenant_id=t;if not found then raise exception 'Operatore non trovato';end if;
 update public.business_hours set chiuso=p_closed,fasce=case when p_closed then '[]'::jsonb else p_ranges end where tenant_id=t and operator_id=p_operator and weekday=p_weekday;
 if not found then insert into public.business_hours(tenant_id,operator_id,weekday,chiuso,fasce) values(t,p_operator,p_weekday,p_closed,case when p_closed then '[]'::jsonb else p_ranges end);end if;
end $;
revoke all on function public.prenow_owner_save_hours(text,uuid,integer,boolean,jsonb) from public,anon;
grant execute on function public.prenow_owner_save_hours(text,uuid,integer,boolean,jsonb) to authenticated;

create or replace function public.prenow_owner_add_absence(p_slug text,p_operator uuid,p_start date,p_end date,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $
declare ctx jsonb;t uuid;result uuid;
begin
 ctx:=public.prenow_owner_context(p_slug);if ctx->>'role' not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato';end if;t:=(ctx->>'tenant_id')::uuid;
 if p_start is null or p_end is null or p_end<p_start or length(coalesce(p_reason,''))>500 then raise exception 'Dati non validi';end if;
 perform 1 from public.operators where id=p_operator and tenant_id=t;if not found then raise exception 'Operatore non trovato';end if;
 insert into public.operator_absences(tenant_id,operator_id,data_inizio,data_fine,motivo) values(t,p_operator,p_start,p_end,nullif(trim(coalesce(p_reason,'')),'')) returning id into result;return result;
end $;
revoke all on function public.prenow_owner_add_absence(text,uuid,date,date,text) from public,anon;
grant execute on function public.prenow_owner_add_absence(text,uuid,date,date,text) to authenticated;

create or replace function public.prenow_owner_delete_absence(p_slug text,p_operator uuid,p_absence uuid)
returns void language plpgsql security definer set search_path='' as $
declare ctx jsonb;t uuid;
begin
 ctx:=public.prenow_owner_context(p_slug);if ctx->>'role' not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato';end if;t:=(ctx->>'tenant_id')::uuid;
 delete from public.operator_absences where id=p_absence and operator_id=p_operator and tenant_id=t;if not found then raise exception 'Assenza non trovata';end if;
end $;
revoke all on function public.prenow_owner_delete_absence(text,uuid,uuid) from public,anon;
grant execute on function public.prenow_owner_delete_absence(text,uuid,uuid) to authenticated;

create or replace function public.prenow_owner_remove_operator(p_slug text,p_operator uuid)
returns void language plpgsql security definer set search_path='' as $
declare ctx jsonb;t uuid;
begin
 ctx:=public.prenow_owner_context(p_slug);if ctx->>'role' not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato';end if;t:=(ctx->>'tenant_id')::uuid;
 update public.operators set attivo=false,updated_at=now() where id=p_operator and tenant_id=t;if not found then raise exception 'Operatore non trovato';end if;
 update public.tenant_users set attivo=false where tenant_id=t and operator_id=p_operator and user_id is distinct from auth.uid();
end $;
revoke all on function public.prenow_owner_remove_operator(text,uuid) from public,anon;
grant execute on function public.prenow_owner_remove_operator(text,uuid) to authenticated;

create or replace function public.prenow_staff_create_customer(p_tenant uuid,p_name text,p_surname text,p_email text,p_phone text)
returns uuid language plpgsql security definer set search_path='' as $
declare member_role text;result uuid;normalized_email text:=nullif(lower(trim(coalesce(p_email,''))),'');normalized_phone text:=nullif(trim(coalesce(p_phone,'')),'');
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Accesso non autorizzato';end if;
 if not coalesce(public.is_platform_admin(),false) then select ruolo into member_role from public.tenant_users where tenant_id=p_tenant and user_id=auth.uid() and attivo=true;if member_role not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato';end if;end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 120 or length(coalesce(p_surname,''))>120 or (normalized_email is not null and normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+) or p_role not in ('staff','operator') or p_active is null then raise exception 'Dati non validi';end if;
 if exists(select 1 from unnest(service_ids) x where not exists(select 1 from public.services s where s.id=x and s.tenant_id=t)) then raise exception 'Servizio non valido';end if;
 select id into uid from auth.users where lower(email)=normalized_email limit 1; oid:=p_operator_id;
 if oid is null then
  insert into public.operators(tenant_id,nome,cognome,email,telefono,attivo) values(t,trim(p_name),nullif(trim(coalesce(p_surname,'')),''),normalized_email,nullif(trim(coalesce(p_phone,'')),''),p_active) returning id into oid;
 else
  update public.operators set nome=trim(p_name),cognome=nullif(trim(coalesce(p_surname,'')),''),email=normalized_email,telefono=nullif(trim(coalesce(p_phone,'')),''),attivo=p_active,updated_at=now() where id=oid and tenant_id=t;
  if not found then raise exception 'Operatore non trovato';end if;
 end if;
 if p_membership_id is null then
  insert into public.tenant_users(tenant_id,user_id,ruolo,nome,cognome,email,telefono,operator_id,attivo) values(t,uid,p_role,trim(p_name),nullif(trim(coalesce(p_surname,'')),''),normalized_email,nullif(trim(coalesce(p_phone,'')),''),oid,p_active) returning id into mid;
 else
  if exists(select 1 from public.tenant_users where id=p_membership_id and tenant_id=t and user_id=auth.uid()) then raise exception 'Non puoi modificare il tuo accesso';end if;
  update public.tenant_users set user_id=coalesce(user_id,uid),ruolo=p_role,nome=trim(p_name),cognome=nullif(trim(coalesce(p_surname,'')),''),email=normalized_email,telefono=nullif(trim(coalesce(p_phone,'')),''),operator_id=oid,attivo=p_active where id=p_membership_id and tenant_id=t returning id into mid;
  if mid is null then raise exception 'Collaboratore non trovato';end if;
 end if;
 delete from public.operator_services where operator_id=oid;
 insert into public.operator_services(operator_id,service_id) select oid,x from unnest(service_ids) x on conflict do nothing;
 return mid;
end $$;
revoke all on function public.prenow_owner_manage_staff(text,uuid,uuid,text,text,text,text,text,boolean,uuid[]) from public,anon;
grant execute on function public.prenow_owner_manage_staff(text,uuid,uuid,text,text,text,text,text,boolean,uuid[]) to authenticated;

create or replace function public.prenow_staff_agenda(p_slug text,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb;t uuid;title text;role_name text;own_operator uuid;
begin
 ctx:=public.prenow_owner_context(p_slug);t:=(ctx->>'tenant_id')::uuid;role_name:=ctx->>'role';own_operator:=nullif(ctx->>'operator_id','')::uuid;
 select nome into title from public.tenants where id=t;
 return jsonb_build_object('nome',title,'role',role_name,'appointments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'start_at',a.start_at,'end_at',a.end_at,'stato',a.stato,'operator_id',a.operator_id,'customer',c.nome||' '||coalesce(c.cognome,''),'operator',o.nome,'service',s.nome) order by a.start_at) from public.appointments a join public.customers c on c.id=a.customer_id and c.tenant_id=t join public.operators o on o.id=a.operator_id and o.tenant_id=t join public.services s on s.id=a.service_id and s.tenant_id=t where a.tenant_id=t and (a.start_at at time zone 'Europe/Rome')::date=p_date and (role_name<>'operator' or a.operator_id=own_operator)),'[]'::jsonb));
end $$;

create or replace function public.prenow_owner_dashboard(p_slug text,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb;t uuid;r text;op uuid;result jsonb;
begin
 ctx:=public.prenow_owner_context(p_slug);t:=(ctx->>'tenant_id')::uuid;r:=ctx->>'role';op:=nullif(ctx->>'operator_id','')::uuid;
 select jsonb_build_object('today_count',(select count(*) from public.appointments where tenant_id=t and (start_at at time zone 'Europe/Rome')::date=p_date and stato='confermato' and (r<>'operator' or operator_id=op)),'upcoming_count',(select count(*) from public.appointments where tenant_id=t and start_at>=now() and stato='confermato' and (r<>'operator' or operator_id=op)),'customers_count',case when r='operator' then null else (select count(*) from public.customers where tenant_id=t) end,'active_services',(select count(*) from public.services where tenant_id=t and attivo),'next',coalesce((select jsonb_agg(x) from (select a.id,a.start_at,c.nome||' '||coalesce(c.cognome,'') customer,o.nome operator,s.nome service from public.appointments a join public.customers c on c.id=a.customer_id join public.operators o on o.id=a.operator_id join public.services s on s.id=a.service_id where a.tenant_id=t and (a.start_at at time zone 'Europe/Rome')::date=p_date and a.stato='confermato' and (r<>'operator' or a.operator_id=op) order by a.start_at limit 8)x),'[]'::jsonb)) into result;
 return result;
end $$;

commit;) or length(coalesce(normalized_phone,''))>25 or (normalized_email is null and normalized_phone is null) then raise exception 'Dati non validi';end if;
 insert into public.customers(tenant_id,nome,cognome,email,telefono) values(p_tenant,trim(p_name),nullif(trim(coalesce(p_surname,'')),''),normalized_email,normalized_phone) returning id into result;return result;
end $;
revoke all on function public.prenow_staff_create_customer(uuid,text,text,text,text) from public,anon;
grant execute on function public.prenow_staff_create_customer(uuid,text,text,text,text) to authenticated;

commit;) or p_role not in ('staff','operator') or p_active is null then raise exception 'Dati non validi';end if;
 if exists(select 1 from unnest(service_ids) x where not exists(select 1 from public.services s where s.id=x and s.tenant_id=t)) then raise exception 'Servizio non valido';end if;
 select id into uid from auth.users where lower(email)=normalized_email limit 1; oid:=p_operator_id;
 if oid is null then
  insert into public.operators(tenant_id,nome,cognome,email,telefono,attivo) values(t,trim(p_name),nullif(trim(coalesce(p_surname,'')),''),normalized_email,nullif(trim(coalesce(p_phone,'')),''),p_active) returning id into oid;
 else
  update public.operators set nome=trim(p_name),cognome=nullif(trim(coalesce(p_surname,'')),''),email=normalized_email,telefono=nullif(trim(coalesce(p_phone,'')),''),attivo=p_active,updated_at=now() where id=oid and tenant_id=t;
  if not found then raise exception 'Operatore non trovato';end if;
 end if;
 if p_membership_id is null then
  insert into public.tenant_users(tenant_id,user_id,ruolo,nome,cognome,email,telefono,operator_id,attivo) values(t,uid,p_role,trim(p_name),nullif(trim(coalesce(p_surname,'')),''),normalized_email,nullif(trim(coalesce(p_phone,'')),''),oid,p_active) returning id into mid;
 else
  if exists(select 1 from public.tenant_users where id=p_membership_id and tenant_id=t and user_id=auth.uid()) then raise exception 'Non puoi modificare il tuo accesso';end if;
  update public.tenant_users set user_id=coalesce(user_id,uid),ruolo=p_role,nome=trim(p_name),cognome=nullif(trim(coalesce(p_surname,'')),''),email=normalized_email,telefono=nullif(trim(coalesce(p_phone,'')),''),operator_id=oid,attivo=p_active where id=p_membership_id and tenant_id=t returning id into mid;
  if mid is null then raise exception 'Collaboratore non trovato';end if;
 end if;
 delete from public.operator_services where operator_id=oid;
 insert into public.operator_services(operator_id,service_id) select oid,x from unnest(service_ids) x on conflict do nothing;
 return mid;
end $$;
revoke all on function public.prenow_owner_manage_staff(text,uuid,uuid,text,text,text,text,text,boolean,uuid[]) from public,anon;
grant execute on function public.prenow_owner_manage_staff(text,uuid,uuid,text,text,text,text,text,boolean,uuid[]) to authenticated;

create or replace function public.prenow_staff_agenda(p_slug text,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb;t uuid;title text;role_name text;own_operator uuid;
begin
 ctx:=public.prenow_owner_context(p_slug);t:=(ctx->>'tenant_id')::uuid;role_name:=ctx->>'role';own_operator:=nullif(ctx->>'operator_id','')::uuid;
 select nome into title from public.tenants where id=t;
 return jsonb_build_object('nome',title,'role',role_name,'appointments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'start_at',a.start_at,'end_at',a.end_at,'stato',a.stato,'operator_id',a.operator_id,'customer',c.nome||' '||coalesce(c.cognome,''),'operator',o.nome,'service',s.nome) order by a.start_at) from public.appointments a join public.customers c on c.id=a.customer_id and c.tenant_id=t join public.operators o on o.id=a.operator_id and o.tenant_id=t join public.services s on s.id=a.service_id and s.tenant_id=t where a.tenant_id=t and (a.start_at at time zone 'Europe/Rome')::date=p_date and (role_name<>'operator' or a.operator_id=own_operator)),'[]'::jsonb));
end $$;

create or replace function public.prenow_owner_dashboard(p_slug text,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb;t uuid;r text;op uuid;result jsonb;
begin
 ctx:=public.prenow_owner_context(p_slug);t:=(ctx->>'tenant_id')::uuid;r:=ctx->>'role';op:=nullif(ctx->>'operator_id','')::uuid;
 select jsonb_build_object('today_count',(select count(*) from public.appointments where tenant_id=t and (start_at at time zone 'Europe/Rome')::date=p_date and stato='confermato' and (r<>'operator' or operator_id=op)),'upcoming_count',(select count(*) from public.appointments where tenant_id=t and start_at>=now() and stato='confermato' and (r<>'operator' or operator_id=op)),'customers_count',case when r='operator' then null else (select count(*) from public.customers where tenant_id=t) end,'active_services',(select count(*) from public.services where tenant_id=t and attivo),'next',coalesce((select jsonb_agg(x) from (select a.id,a.start_at,c.nome||' '||coalesce(c.cognome,'') customer,o.nome operator,s.nome service from public.appointments a join public.customers c on c.id=a.customer_id join public.operators o on o.id=a.operator_id join public.services s on s.id=a.service_id where a.tenant_id=t and (a.start_at at time zone 'Europe/Rome')::date=p_date and a.stato='confermato' and (r<>'operator' or a.operator_id=op) order by a.start_at limit 8)x),'[]'::jsonb)) into result;
 return result;
end $$;

commit;