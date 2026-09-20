-- Recurring appointments for owner/staff manual booking.
-- Applied to production through Supabase migration: recurring_appointments.

create table if not exists public.appointment_series (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  operator_id uuid not null references public.operators(id) on delete restrict,
  service_id uuid references public.services(id) on delete restrict,
  custom_service_name text,
  custom_duration_min integer,
  custom_price_cents integer,
  recurrence_type text not null check (recurrence_type in ('weekly','biweekly','monthly_day','monthly_nth_weekday')),
  anchor_start timestamptz not null,
  end_mode text not null check (end_mode in ('count','date')),
  occurrence_count integer,
  end_date date,
  week_of_month integer,
  weekday integer,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint appointment_series_service_mode_check check (
    (service_id is not null and custom_service_name is null and custom_duration_min is null and custom_price_cents is null)
    or
    (service_id is null and custom_service_name is not null and custom_duration_min is not null and custom_price_cents is not null)
  ),
  constraint appointment_series_end_check check (
    (end_mode='count' and occurrence_count between 2 and 60 and end_date is null)
    or
    (end_mode='date' and end_date is not null and occurrence_count is null)
  ),
  constraint appointment_series_nth_check check (
    recurrence_type<>'monthly_nth_weekday'
    or (week_of_month in (-1,1,2,3,4) and weekday between 0 and 6)
  )
);

alter table public.appointment_series enable row level security;

drop policy if exists appointment_series_read_managers on public.appointment_series;
create policy appointment_series_read_managers on public.appointment_series
for select to authenticated
using (
  coalesce(public.is_platform_admin(),false)
  or exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id=appointment_series.tenant_id
      and tu.user_id=auth.uid()
      and tu.attivo=true
      and tu.ruolo in ('tenant_admin','staff')
  )
);

alter table public.appointments
  add column if not exists series_id uuid references public.appointment_series(id) on delete set null,
  add column if not exists occurrence_number integer;

create index if not exists idx_appointments_series_id on public.appointments(series_id);

create or replace function public.prenow_recurrence_occurrences(
  p_anchor date,p_type text,p_end_mode text,p_count integer,p_end_date date,p_week_of_month integer,p_weekday integer
)
returns table(occurrence_no integer, occurrence_date date)
language plpgsql immutable set search_path to ''
as $$
declare i integer:=1;d date;m date;first_day date;last_day date;offset_days integer;
begin
  if p_anchor is null then raise exception 'Data iniziale non valida'; end if;
  if p_type not in ('weekly','biweekly','monthly_day','monthly_nth_weekday') then raise exception 'Ricorrenza non valida'; end if;
  if p_end_mode not in ('count','date') then raise exception 'Termine ricorrenza non valido'; end if;
  if p_end_mode='count' and (p_count is null or p_count<2 or p_count>60) then raise exception 'Numero appuntamenti non valido'; end if;
  if p_end_mode='date' and (p_end_date is null or p_end_date<p_anchor or p_end_date>p_anchor+730) then raise exception 'Data finale non valida'; end if;
  if p_type='monthly_nth_weekday' and (p_week_of_month not in (-1,1,2,3,4) or p_weekday not between 0 and 6) then raise exception 'Regola mensile non valida'; end if;
  loop
    exit when i>60;
    if i=1 then d:=p_anchor;
    elsif p_type='weekly' then d:=p_anchor+((i-1)*7);
    elsif p_type='biweekly' then d:=p_anchor+((i-1)*14);
    elsif p_type='monthly_day' then
      m:=(date_trunc('month',p_anchor)::date+make_interval(months=>i-1))::date;
      last_day:=(m+interval '1 month - 1 day')::date;
      d:=make_date(extract(year from m)::int,extract(month from m)::int,least(extract(day from p_anchor)::int,extract(day from last_day)::int));
    else
      m:=(date_trunc('month',p_anchor)::date+make_interval(months=>i-1))::date;
      if p_week_of_month=-1 then
        last_day:=(m+interval '1 month - 1 day')::date;
        offset_days:=(extract(dow from last_day)::int-p_weekday+7)%7;
        d:=last_day-offset_days;
      else
        first_day:=m;
        offset_days:=(p_weekday-extract(dow from first_day)::int+7)%7;
        d:=first_day+offset_days+((p_week_of_month-1)*7);
      end if;
    end if;
    if p_end_mode='count' then exit when i>p_count; else exit when d>p_end_date; end if;
    occurrence_no:=i;occurrence_date:=d;return next;i:=i+1;
  end loop;
end;
$$;

create or replace function public.prenow_staff_exact_slot_available(
  p_tenant uuid,p_operator uuid,p_service uuid,p_start timestamptz,p_duration integer
)
returns boolean language plpgsql stable security definer set search_path to ''
as $$
declare local_date date;local_start time;local_end time;schedule public.business_hours%rowtype;
begin
  if p_start is null or p_duration not between 5 and 480 or p_start<=now() then return false; end if;
  if not exists(select 1 from public.operators where id=p_operator and tenant_id=p_tenant and attivo=true) then return false; end if;
  if p_service is not null and not exists(
    select 1 from public.services s join public.operator_services os on os.service_id=s.id and os.operator_id=p_operator
    where s.id=p_service and s.tenant_id=p_tenant and s.attivo=true
  ) then return false; end if;
  local_date:=(p_start at time zone 'Europe/Rome')::date;
  local_start:=(p_start at time zone 'Europe/Rome')::time;
  local_end:=((p_start+make_interval(mins=>p_duration)) at time zone 'Europe/Rome')::time;
  select h.* into schedule from public.business_hours h
  where h.tenant_id=p_tenant and h.weekday=extract(dow from local_date)::int and (h.operator_id=p_operator or h.operator_id is null)
  order by (h.operator_id is not null) desc,h.id limit 1;
  if schedule.id is null or schedule.chiuso then return false; end if;
  if not exists(select 1 from jsonb_array_elements(schedule.fasce) f where local_start>=(f->>'da')::time and local_end<=(f->>'a')::time) then return false; end if;
  if exists(select 1 from public.appointments a where a.operator_id=p_operator and a.stato not in ('cancellato_cliente','cancellato_negozio') and a.start_at<p_start+make_interval(mins=>p_duration) and a.end_at>p_start) then return false; end if;
  if exists(select 1 from public.closures b where b.tenant_id=p_tenant and local_date between b.data_inizio and b.data_fine and (b.tutto_il_giorno or (((local_date+b.ora_inizio) at time zone 'Europe/Rome')<p_start+make_interval(mins=>p_duration) and ((local_date+b.ora_fine) at time zone 'Europe/Rome')>p_start))) then return false; end if;
  if exists(select 1 from public.operator_absences b where b.tenant_id=p_tenant and b.operator_id=p_operator and local_date between b.data_inizio and b.data_fine and (b.tutto_il_giorno or (((local_date+b.ora_inizio) at time zone 'Europe/Rome')<p_start+make_interval(mins=>p_duration) and ((local_date+b.ora_fine) at time zone 'Europe/Rome')>p_start))) then return false; end if;
  if exists(select 1 from public.manual_blocks b where b.tenant_id=p_tenant and (b.operator_id=p_operator or b.operator_id is null) and b.data=local_date and ((local_date+b.ora_inizio) at time zone 'Europe/Rome')<p_start+make_interval(mins=>p_duration) and ((local_date+b.ora_fine) at time zone 'Europe/Rome')>p_start) then return false; end if;
  return true;
end;
$$;

create or replace function public.prenow_staff_preview_recurrence(
  p_tenant uuid,p_service uuid,p_operator uuid,p_start timestamptz,p_custom_name text,p_custom_duration integer,
  p_recurrence_type text,p_end_mode text,p_count integer,p_end_date date,p_week_of_month integer,p_weekday integer
)
returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare member_role text;duration integer;anchor_date date;anchor_time time;r record;occurrence_start timestamptz;ok boolean;items jsonb:='[]'::jsonb;total integer:=0;available integer:=0;
begin
  if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
  if not coalesce(public.is_platform_admin(),false) then
    select ruolo into member_role from public.tenant_users where tenant_id=p_tenant and user_id=auth.uid() and attivo=true;
    if member_role is null or member_role not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato'; end if;
  end if;
  if p_service is null then
    if length(trim(coalesce(p_custom_name,''))) not between 1 and 120 or p_custom_duration not between 5 and 480 then raise exception 'Servizio personalizzato non valido'; end if;
    duration:=p_custom_duration;
  else
    select durata_min into duration from public.services where id=p_service and tenant_id=p_tenant and attivo=true;
    if duration is null then raise exception 'Servizio non valido'; end if;
  end if;
  anchor_date:=(p_start at time zone 'Europe/Rome')::date;anchor_time:=(p_start at time zone 'Europe/Rome')::time;
  for r in select * from public.prenow_recurrence_occurrences(anchor_date,p_recurrence_type,p_end_mode,p_count,p_end_date,p_week_of_month,p_weekday) loop
    occurrence_start:=(r.occurrence_date+anchor_time) at time zone 'Europe/Rome';
    ok:=public.prenow_staff_exact_slot_available(p_tenant,p_operator,p_service,occurrence_start,duration);
    total:=total+1;if ok then available:=available+1;end if;
    items:=items||jsonb_build_array(jsonb_build_object('occurrence_no',r.occurrence_no,'date',r.occurrence_date,'start_at',occurrence_start,'available',ok));
  end loop;
  return jsonb_build_object('total',total,'available',available,'conflicts',total-available,'occurrences',items);
end;
$$;

create or replace function public.prenow_staff_book_recurrence(
  p_tenant uuid,p_customer uuid,p_service uuid,p_operator uuid,p_start timestamptz,p_note text,
  p_custom_name text,p_custom_duration integer,p_custom_price_cents integer,
  p_recurrence_type text,p_end_mode text,p_count integer,p_end_date date,p_week_of_month integer,p_weekday integer
)
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare member_role text;duration integer;series_id uuid;anchor_date date;anchor_time time;r record;occurrence_start timestamptz;ok boolean;created integer:=0;conflicts integer:=0;items jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Accesso non autorizzato'; end if;
  if not coalesce(public.is_platform_admin(),false) then
    select ruolo into member_role from public.tenant_users where tenant_id=p_tenant and user_id=auth.uid() and attivo=true;
    if member_role is null or member_role not in ('tenant_admin','staff') then raise exception 'Accesso non autorizzato'; end if;
  end if;
  if p_customer is null or not exists(select 1 from public.customers where id=p_customer and tenant_id=p_tenant) then raise exception 'Cliente non valido'; end if;
  if length(coalesce(p_note,''))>1000 then raise exception 'Note non valide'; end if;
  if p_service is null then
    if length(trim(coalesce(p_custom_name,''))) not between 1 and 120 or p_custom_duration not between 5 and 480 or p_custom_price_cents is null or p_custom_price_cents<0 then raise exception 'Servizio personalizzato non valido'; end if;
    duration:=p_custom_duration;
  else
    select durata_min into duration from public.services where id=p_service and tenant_id=p_tenant and attivo=true;
    if duration is null then raise exception 'Servizio non valido'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operator::text,0));
  insert into public.appointment_series(tenant_id,customer_id,operator_id,service_id,custom_service_name,custom_duration_min,custom_price_cents,recurrence_type,anchor_start,end_mode,occurrence_count,end_date,week_of_month,weekday,note,created_by)
  values(p_tenant,p_customer,p_operator,p_service,case when p_service is null then trim(p_custom_name) end,case when p_service is null then p_custom_duration end,case when p_service is null then p_custom_price_cents end,p_recurrence_type,p_start,p_end_mode,case when p_end_mode='count' then p_count end,case when p_end_mode='date' then p_end_date end,case when p_recurrence_type='monthly_nth_weekday' then p_week_of_month end,case when p_recurrence_type='monthly_nth_weekday' then p_weekday end,nullif(trim(coalesce(p_note,'')),''),auth.uid())
  returning id into series_id;
  anchor_date:=(p_start at time zone 'Europe/Rome')::date;anchor_time:=(p_start at time zone 'Europe/Rome')::time;
  for r in select * from public.prenow_recurrence_occurrences(anchor_date,p_recurrence_type,p_end_mode,p_count,p_end_date,p_week_of_month,p_weekday) loop
    occurrence_start:=(r.occurrence_date+anchor_time) at time zone 'Europe/Rome';
    ok:=public.prenow_staff_exact_slot_available(p_tenant,p_operator,p_service,occurrence_start,duration);
    if ok then
      insert into public.appointments(tenant_id,customer_id,service_id,operator_id,start_at,end_at,stato,note,created_by_staff,custom_service_name,custom_duration_min,custom_price_cents,series_id,occurrence_number)
      values(p_tenant,p_customer,p_service,p_operator,occurrence_start,occurrence_start+make_interval(mins=>duration),'confermato',nullif(trim(coalesce(p_note,'')),''),true,case when p_service is null then trim(p_custom_name) end,case when p_service is null then p_custom_duration end,case when p_service is null then p_custom_price_cents end,series_id,r.occurrence_no);
      created:=created+1;items:=items||jsonb_build_array(jsonb_build_object('occurrence_no',r.occurrence_no,'date',r.occurrence_date,'start_at',occurrence_start,'created',true));
    else
      conflicts:=conflicts+1;items:=items||jsonb_build_array(jsonb_build_object('occurrence_no',r.occurrence_no,'date',r.occurrence_date,'start_at',occurrence_start,'created',false));
    end if;
  end loop;
  if created=0 then delete from public.appointment_series where id=series_id;raise exception 'Nessuna occorrenza disponibile';end if;
  return jsonb_build_object('series_id',series_id,'created',created,'conflicts',conflicts,'occurrences',items);
end;
$$;

revoke all on function public.prenow_recurrence_occurrences(date,text,text,integer,date,integer,integer) from public, anon, authenticated;
revoke all on function public.prenow_staff_exact_slot_available(uuid,uuid,uuid,timestamptz,integer) from public, anon, authenticated;
revoke all on function public.prenow_staff_preview_recurrence(uuid,uuid,uuid,timestamptz,text,integer,text,text,integer,date,integer,integer) from public, anon;
revoke all on function public.prenow_staff_book_recurrence(uuid,uuid,uuid,uuid,timestamptz,text,text,integer,integer,text,text,integer,date,integer,integer) from public, anon;
grant execute on function public.prenow_staff_preview_recurrence(uuid,uuid,uuid,timestamptz,text,integer,text,text,integer,date,integer,integer) to authenticated;
grant execute on function public.prenow_staff_book_recurrence(uuid,uuid,uuid,uuid,timestamptz,text,text,integer,integer,text,text,integer,date,integer,integer) to authenticated;
