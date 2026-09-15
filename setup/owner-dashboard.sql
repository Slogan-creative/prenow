begin;
create or replace function public.prenow_owner_context(p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t uuid;n text;r text;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Accesso non autorizzato';end if;
 select id,nome into t,n from public.tenants where slug=p_slug;
 if t is null then raise exception 'Attività non disponibile';end if;
 if coalesce(public.is_platform_admin(),false) then r:='tenant_admin';else select ruolo into r from public.tenant_users where tenant_id=t and user_id=auth.uid();end if;
 if r is distinct from 'tenant_admin' then raise exception 'Accesso riservato al titolare';end if;
 return jsonb_build_object('tenant_id',t,'nome',n,'slug',p_slug,'role','tenant_admin');
end$$;
revoke all on function public.prenow_owner_context(text) from public,anon;grant execute on function public.prenow_owner_context(text) to authenticated;

create or replace function public.prenow_owner_dashboard(p_slug text,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t uuid;result jsonb;
begin
 t:=(public.prenow_owner_context(p_slug)->>'tenant_id')::uuid;
 select jsonb_build_object('today_count',(select count(*) from public.appointments where tenant_id=t and (start_at at time zone 'Europe/Rome')::date=p_date and stato='confermato'),'upcoming_count',(select count(*) from public.appointments where tenant_id=t and start_at>=now() and stato='confermato'),'customers_count',(select count(*) from public.customers where tenant_id=t),'active_services',(select count(*) from public.services where tenant_id=t and attivo),'next',coalesce((select jsonb_agg(x) from (select a.id,a.start_at,c.nome||' '||coalesce(c.cognome,'') customer,o.nome operator,s.nome service from public.appointments a join public.customers c on c.id=a.customer_id join public.operators o on o.id=a.operator_id join public.services s on s.id=a.service_id where a.tenant_id=t and (a.start_at at time zone 'Europe/Rome')::date=p_date and a.stato='confermato' order by a.start_at limit 8)x),'[]'::jsonb)) into result;return result;
end$$;
revoke all on function public.prenow_owner_dashboard(text,date) from public,anon;grant execute on function public.prenow_owner_dashboard(text,date) to authenticated;

create or replace function public.prenow_owner_save_settings(p_slug text,p_name text,p_description text,p_via text,p_cap text,p_citta text,p_provincia text,p_phone text,p_whatsapp text,p_email text,p_maps_url text,p_website text,p_instagram text,p_facebook text,p_logo_url text,p_primary text,p_background text,p_text text) returns boolean language plpgsql security definer set search_path='' as $$
declare t uuid;
begin
 t:=(public.prenow_owner_context(p_slug)->>'tenant_id')::uuid;
 if length(trim(coalesce(p_name,''))) not between 1 and 120 or p_primary!~'^#[0-9a-fA-F]{6}$' or p_background!~'^#[0-9a-fA-F]{6}$' or p_text!~'^#[0-9a-fA-F]{6}$' then raise exception 'Dati non validi';end if;
 update public.tenants set nome=trim(p_name),updated_at=now() where id=t;
 insert into public.tenant_settings(tenant_id,descrizione,via,cap,citta,provincia,telefono,whatsapp,email,maps_url,sito_web,instagram,facebook) values(t,nullif(p_description,''),nullif(p_via,''),nullif(p_cap,''),nullif(p_citta,''),nullif(p_provincia,''),nullif(p_phone,''),nullif(p_whatsapp,''),nullif(lower(p_email),''),nullif(p_maps_url,''),nullif(p_website,''),nullif(p_instagram,''),nullif(p_facebook,'')) on conflict(tenant_id) do update set descrizione=excluded.descrizione,via=excluded.via,cap=excluded.cap,citta=excluded.citta,provincia=excluded.provincia,telefono=excluded.telefono,whatsapp=excluded.whatsapp,email=excluded.email,maps_url=excluded.maps_url,sito_web=excluded.sito_web,instagram=excluded.instagram,facebook=excluded.facebook,updated_at=now();
 insert into public.tenant_branding(tenant_id,logo_url,color_primary,color_bg,color_text) values(t,nullif(p_logo_url,''),lower(p_primary),lower(p_background),lower(p_text)) on conflict(tenant_id) do update set logo_url=excluded.logo_url,color_primary=excluded.color_primary,color_bg=excluded.color_bg,color_text=excluded.color_text,updated_at=now();return true;
end$$;
revoke all on function public.prenow_owner_save_settings(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon;grant execute on function public.prenow_owner_save_settings(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
commit;
