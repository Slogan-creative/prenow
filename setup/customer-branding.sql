begin;
-- Solo identità grafica pubblica: nessun dato cliente e nessun accesso diretto alle tabelle.
create or replace function public.prenow_customer_branding(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('nome',t.nome,'logo_url',b.logo_url,
  'color_primary',b.color_primary,'color_bg',b.color_bg,'color_text',b.color_text)
 from public.tenants t left join public.tenant_branding b on b.tenant_id=t.id
 where t.slug=p_slug;
$$;
revoke all on function public.prenow_customer_branding(text) from public;
grant execute on function public.prenow_customer_branding(text) to anon, authenticated;
commit;
