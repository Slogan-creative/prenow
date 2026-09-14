-- Solo database di test. Richiede revisione RLS prima dell'attivazione.
begin;
create or replace function public.prenow_manage_staff(p_tenant uuid,p_user uuid,p_role text,p_name text,p_operator uuid,p_remove boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_platform_admin(),false) then raise exception 'Accesso non autorizzato';end if;
 perform 1 from public.tenants where id=p_tenant for update;if not found then raise exception 'Salone non disponibile';end if;
 if p_user is null then raise exception 'Utente non valido';end if;
 if p_remove then delete from public.tenant_users where tenant_id=p_tenant and user_id=p_user;return;end if;
 if p_role is null or p_role not in ('tenant_admin','staff','operator') or p_name is null or length(trim(p_name)) not between 1 and 120 then raise exception 'Dati non validi';end if;
 perform 1 from auth.users where id=p_user;if not found then raise exception 'Utente non registrato';end if;
 if p_role='operator' then
  perform 1 from public.operators where id=p_operator and tenant_id=p_tenant;if not found then raise exception 'Operatore non appartenente al salone';end if;
 else p_operator:=null;end if;
 insert into public.tenant_users(tenant_id,user_id,ruolo,nome,operator_id) values(p_tenant,p_user,p_role,trim(p_name),p_operator)
 on conflict(tenant_id,user_id) do update set ruolo=excluded.ruolo,nome=excluded.nome,operator_id=excluded.operator_id;
end $$;
revoke all on function public.prenow_manage_staff(uuid,uuid,text,text,uuid,boolean) from public,anon;
grant execute on function public.prenow_manage_staff(uuid,uuid,text,text,uuid,boolean) to authenticated;

create or replace function public.prenow_staff_agenda(p_slug text,p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t uuid; title text; role_name text; own_operator uuid;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato';end if;
 select id,nome into t,title from public.tenants where slug=p_slug;
 if t is null then raise exception 'Salone non disponibile';end if;
 if coalesce(public.is_platform_admin(),false) then role_name:='tenant_admin';
 else
  select ruolo,operator_id into role_name,own_operator from public.tenant_users where tenant_id=t and user_id=auth.uid();
  if role_name is null or role_name not in ('tenant_admin','staff','operator') or (role_name='operator' and own_operator is null) then raise exception 'Accesso non autorizzato';end if;
 end if;
 return jsonb_build_object('nome',title,'role',role_name,'appointments',coalesce((
 select jsonb_agg(jsonb_build_object('id',a.id,'start_at',a.start_at,'end_at',a.end_at,'stato',a.stato,'customer',c.nome||' '||coalesce(c.cognome,''),'operator',o.nome,'service',s.nome) order by a.start_at)
 from public.appointments a join public.customers c on c.id=a.customer_id and c.tenant_id=t join public.operators o on o.id=a.operator_id and o.tenant_id=t join public.services s on s.id=a.service_id and s.tenant_id=t
 where a.tenant_id=t and (a.start_at at time zone 'Europe/Rome')::date=p_date and (role_name<>'operator' or a.operator_id=own_operator)
 ),'[]'::jsonb));
end $$;
revoke all on function public.prenow_staff_agenda(text,date) from public,anon;
grant execute on function public.prenow_staff_agenda(text,date) to authenticated;
create or replace function public.prenow_staff_set_status(p_slug text,p_booking uuid,p_status text)
returns uuid language plpgsql security definer set search_path='' as $
declare t uuid; member_role text; changed uuid;
begin
 if auth.uid() is null then raise exception 'Accesso non autorizzato';end if;
 select id into t from public.tenants where slug=p_slug;
 if t is null then raise exception 'Salone non disponibile';end if;
 if not coalesce(public.is_platform_admin(),false) then
  select ruolo into member_role from public.tenant_users where tenant_id=t and user_id=auth.uid() for share;
  if member_role is null or member_role not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato';end if;
 end if;
 if p_status is null or p_status not in ('cancellato_negozio','completato','no_show') then raise exception 'Stato non valido';end if;
 update public.appointments set stato=p_status,updated_at=now()
 where id=p_booking and tenant_id=t and stato='confermato'
 and (p_status='cancellato_negozio' or end_at<=now())
 returning id into changed;
 if changed is null then raise exception 'Appuntamento già cambiato o non ancora terminato';end if;
 return changed;
end $;
revoke all on function public.prenow_staff_set_status(text,uuid,text) from public,anon;
grant execute on function public.prenow_staff_set_status(text,uuid,text) to authenticated;

commit;
