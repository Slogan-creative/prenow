begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tenant-logos','tenant-logos',true,2097152,array['image/png'])
on conflict(id) do nothing;
-- Loghi pubblici; scrittura riservata al Super Admin, mai ai clienti.
create policy "prenow_logo_admin_insert" on storage.objects for insert to authenticated
with check(bucket_id='tenant-logos' and public.is_platform_admin()
and exists(select 1 from public.tenants t where t.id::text=(storage.foldername(name))[1]));
create policy "prenow_logo_admin_select" on storage.objects for select to authenticated
using(bucket_id='tenant-logos' and public.is_platform_admin());
create policy "prenow_logo_admin_delete" on storage.objects for delete to authenticated
using(bucket_id='tenant-logos' and public.is_platform_admin());
commit;
