-- Règles à collaudare in un progetto isolato prima di qualunque rilascio.
-- L'app cliente usa RPC SECURITY DEFINER per prenotare e cancellare:
-- non necessita INSERT/UPDATE diretti sulle tabelle.
begin;
create or replace function public.prenow_can_read_agenda(p_tenant uuid,p_operator uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (coalesce(public.is_platform_admin(),false) or exists(
 select 1 from public.tenant_users u where u.user_id=auth.uid() and u.tenant_id=p_tenant
 and (u.ruolo in ('tenant_admin','staff') or (u.ruolo='operator' and u.operator_id is not null and u.operator_id=p_operator))));
$$;
revoke all on function public.prenow_can_read_agenda(uuid,uuid) from public,anon;
grant execute on function public.prenow_can_read_agenda(uuid,uuid) to authenticated;
-- Replace permissive existing policies rather than adding another OR policy.
do $$
declare r record;
begin
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('appointments','customers','closures','manual_blocks','operator_absences')
 loop execute format('drop policy %I on public.%I',r.policyname,r.tablename);end loop;
end $$;
alter table public.appointments enable row level security;
alter table public.customers enable row level security;
alter table public.closures enable row level security;
alter table public.manual_blocks enable row level security;
alter table public.operator_absences enable row level security;
create policy prenow_appointments_platform on public.appointments for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy prenow_appointments_staff_read on public.appointments for select to authenticated using(public.prenow_can_read_agenda(tenant_id,operator_id));
create policy prenow_customers_platform on public.customers for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy prenow_customers_self_read on public.customers for select to authenticated using(user_id=auth.uid());
create policy prenow_customers_staff_read on public.customers for select to authenticated using(public.prenow_can_read_agenda(tenant_id,null));
create policy prenow_closures_platform on public.closures for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy prenow_closures_staff_read on public.closures for select to authenticated using(public.prenow_can_read_agenda(tenant_id,null));
create policy prenow_blocks_platform on public.manual_blocks for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy prenow_blocks_staff_read on public.manual_blocks for select to authenticated using(public.prenow_can_read_agenda(tenant_id,operator_id));
create policy prenow_absences_platform on public.operator_absences for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy prenow_absences_staff_read on public.operator_absences for select to authenticated using(public.prenow_can_read_agenda(tenant_id,operator_id));
commit;
