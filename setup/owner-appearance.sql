create or replace function public.prenow_owner_save_appearance(
  p_slug text,
  p_theme text,
  p_primary text,
  p_logo_url text,
  p_logo_light_url text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx jsonb;
  tenant uuid;
begin
  ctx := public.prenow_owner_context(p_slug);
  if coalesce(ctx->>'role','') not in ('tenant_admin','staff') then
    raise exception 'Permesso negato';
  end if;
  if p_theme not in ('scuro','chiaro') or p_primary !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Aspetto non valido';
  end if;
  tenant := (ctx->>'tenant_id')::uuid;
  insert into public.tenant_branding(tenant_id,tema,color_primary,logo_url,logo_light_url)
  values(tenant,case when p_theme='chiaro' then 'light' else 'dark' end,lower(p_primary),nullif(p_logo_url,''),nullif(p_logo_light_url,''))
  on conflict(tenant_id) do update set
    tema=excluded.tema,
    color_primary=excluded.color_primary,
    logo_url=excluded.logo_url,
    logo_light_url=excluded.logo_light_url,
    updated_at=now();
  return true;
end;
$$;

revoke all on function public.prenow_owner_save_appearance(text,text,text,text,text) from public, anon;
grant execute on function public.prenow_owner_save_appearance(text,text,text,text,text) to authenticated;

update storage.buckets
set public=true,
    file_size_limit=2097152,
    allowed_mime_types=array['image/png','image/jpeg','image/webp']
where id='tenant-logos';

drop policy if exists prenow_logo_manager_insert on storage.objects;
create policy prenow_logo_manager_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='tenant-logos'
  and exists (
    select 1 from public.tenant_users tu
    where tu.user_id=(select auth.uid())
      and tu.attivo
      and tu.ruolo in ('tenant_admin','staff')
      and tu.tenant_id::text=(storage.foldername(name))[1]
  )
);

drop policy if exists prenow_logo_manager_delete on storage.objects;
create policy prenow_logo_manager_delete on storage.objects
for delete to authenticated
using (
  bucket_id='tenant-logos'
  and exists (
    select 1 from public.tenant_users tu
    where tu.user_id=(select auth.uid())
      and tu.attivo
      and tu.ruolo in ('tenant_admin','staff')
      and tu.tenant_id::text=(storage.foldername(name))[1]
  )
);
