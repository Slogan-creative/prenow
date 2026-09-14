-- Applicare solo al database di test. Non eseguire sul progetto live.
begin;
create or replace function public.prenow_create_application(p_name text,p_slug text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin(),false) then raise exception 'Accesso non autorizzato';end if;
 if p_name is null or length(trim(p_name)) not between 1 and 120 or p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$' then raise exception 'Nome o slug non valido';end if;
 insert into public.tenants(nome,slug,stato,domain_status) values(trim(p_name),p_slug,'configurazione','config_required') returning id into result;
 insert into public.tenant_settings(tenant_id) values(result);
 insert into public.tenant_branding(tenant_id) values(result);
 insert into public.business_hours(tenant_id,weekday,chiuso,fasce)
 select result,d,true,'[]'::jsonb from generate_series(0,6) d;
 return result;
end $$;
revoke all on function public.prenow_create_application(text,text) from public,anon;
grant execute on function public.prenow_create_application(text,text) to authenticated;

create or replace function public.prenow_staff_book(p_tenant uuid,p_service uuid,p_operator uuid,p_start timestamptz,p_customer uuid,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; salon_slug text; duration integer; member_role text;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato';end if;
 if not coalesce(public.is_platform_admin(),false) then
 select ruolo into member_role from public.tenant_users where tenant_id=p_tenant and user_id=auth.uid() for share;
 if member_role is null or member_role not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato';end if;
 end if;
 if p_start is null or p_customer is null or length(coalesce(p_note,''))>1000 then raise exception 'Dati non validi';end if;
 select slug into salon_slug from public.tenants where id=p_tenant;
 if salon_slug is null then raise exception 'Salone non disponibile';end if;
 perform 1 from public.customers where id=p_customer and tenant_id=p_tenant;
 if not found then raise exception 'Cliente non appartenente al salone';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operator::text,0));
 if not exists(select 1 from public.prenow_customer_slots(salon_slug,p_service,p_operator,(p_start at time zone 'Europe/Rome')::date) a where a.start_at=p_start) then raise exception 'Orario non disponibile';end if;
 select durata_min into duration from public.services where id=p_service and tenant_id=p_tenant;
 insert into public.appointments(tenant_id,customer_id,service_id,operator_id,start_at,end_at,stato,note,created_by_staff)
 values(p_tenant,p_customer,p_service,p_operator,p_start,p_start+make_interval(mins=>duration),'confermato',nullif(trim(p_note),''),true) returning id into result;
 return result;
end $$;
revoke all on function public.prenow_staff_book(uuid,uuid,uuid,timestamptz,uuid,text) from public,anon;
grant execute on function public.prenow_staff_book(uuid,uuid,uuid,timestamptz,uuid,text) to authenticated;
commit;
