-- Consente allo stesso endpoint protetto di salvare sia gli orari del negozio
-- (p_operator NULL) sia quelli personali di un operatore.
create or replace function public.prenow_owner_save_hours(
  p_slug text,
  p_operator uuid,
  p_weekday integer,
  p_closed boolean,
  p_ranges jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ctx jsonb;
  t uuid;
begin
  ctx := public.prenow_owner_context(p_slug);
  if ctx->>'role' not in ('tenant_admin','staff') then
    raise exception 'Accesso non autorizzato';
  end if;
  t := (ctx->>'tenant_id')::uuid;

  if p_weekday not between 0 and 6
     or p_closed is null
     or jsonb_typeof(coalesce(p_ranges,'[]'::jsonb)) <> 'array' then
    raise exception 'Dati non validi';
  end if;

  if p_operator is not null then
    perform 1 from public.operators where id=p_operator and tenant_id=t;
    if not found then raise exception 'Operatore non trovato'; end if;
  end if;

  update public.business_hours
     set chiuso=p_closed,
         fasce=case when p_closed then '[]'::jsonb else p_ranges end
   where tenant_id=t
     and operator_id is not distinct from p_operator
     and weekday=p_weekday;

  if not found then
    insert into public.business_hours(tenant_id,operator_id,weekday,chiuso,fasce)
    values(t,p_operator,p_weekday,p_closed,case when p_closed then '[]'::jsonb else p_ranges end);
  end if;
end
$function$;

revoke all on function public.prenow_owner_save_hours(text,uuid,integer,boolean,jsonb) from public, anon;
grant execute on function public.prenow_owner_save_hours(text,uuid,integer,boolean,jsonb) to authenticated;
