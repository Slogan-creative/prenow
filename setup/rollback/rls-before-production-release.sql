-- Ripristino RLS precedente al rilascio; ripristina permessi permissivi, usare solo in emergenza.
begin;
SET LOCAL search_path=public,pg_catalog;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('appointments','customers','closures','manual_blocks','operator_absences') LOOP EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,r.tablename); END LOOP; END $$;
CREATE POLICY "appointments_insert" ON public."appointments" FOR INSERT TO "public" WITH CHECK (((tenant_id IN ( SELECT current_tenant_ids() AS current_tenant_ids)) OR (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid())))));
CREATE POLICY "appointments_read" ON public."appointments" FOR SELECT TO "public" USING (((tenant_id IN ( SELECT current_tenant_ids() AS current_tenant_ids)) OR (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid())))));
CREATE POLICY "appointments_update" ON public."appointments" FOR UPDATE TO "public" USING (((tenant_id IN ( SELECT current_tenant_ids() AS current_tenant_ids)) OR (customer_id IN ( SELECT customers.id
   FROM customers
  WHERE (customers.user_id = auth.uid())))));
CREATE POLICY "prenow_platform_admin" ON public."appointments" FOR ALL TO "authenticated" USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "prenow_platform_admin" ON public."closures" FOR ALL TO "authenticated" USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "public_read_closures" ON public."closures" FOR SELECT TO "public" USING (true);
CREATE POLICY "tenant_staff_write_closures" ON public."closures" FOR ALL TO "public" USING ((tenant_id IN ( SELECT current_tenant_ids() AS current_tenant_ids)));
CREATE POLICY "customer_insert_own" ON public."customers" FOR INSERT TO "public" WITH CHECK (((user_id = auth.uid()) OR (tenant_id IN ( SELECT current_tenant_ids() AS current_tenant_ids))));
CREATE POLICY "customer_read_own" ON public."customers" FOR SELECT TO "public" USING (((user_id = auth.uid()) OR (tenant_id IN ( SELECT current_tenant_ids() AS current_tenant_ids))));
CREATE POLICY "customer_update_own" ON public."customers" FOR UPDATE TO "public" USING (((user_id = auth.uid()) OR (tenant_id IN ( SELECT current_tenant_ids() AS current_tenant_ids))));
CREATE POLICY "prenow_platform_admin" ON public."customers" FOR ALL TO "authenticated" USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "prenow_platform_admin" ON public."manual_blocks" FOR ALL TO "authenticated" USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "public_read_manual_blocks" ON public."manual_blocks" FOR SELECT TO "public" USING (true);
CREATE POLICY "tenant_staff_write_manual_blocks" ON public."manual_blocks" FOR ALL TO "public" USING ((tenant_id IN ( SELECT current_tenant_ids() AS current_tenant_ids)));
CREATE POLICY "prenow_platform_admin" ON public."operator_absences" FOR ALL TO "authenticated" USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "public_read_operator_absences" ON public."operator_absences" FOR SELECT TO "public" USING (true);
CREATE POLICY "tenant_staff_write_operator_absences" ON public."operator_absences" FOR ALL TO "public" USING ((tenant_id IN ( SELECT current_tenant_ids() AS current_tenant_ids)));
commit;
