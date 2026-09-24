-- ============================================================================
-- Workshop service requests (micromobility.sa/workshop), handled in the staff page.
--
-- The owner's rules (2026-09-24): every submission on the main website is received by the staff
-- page; a workshop booking is a REQUEST - the customer picks a service and a preferred day and
-- time, staff confirm, reschedule, price and move it through the workshop. No online payment.
--
--  1. workshop_jobs - one row per request. No anon access: the website writes only through
--     workshop_request(); staff read and update, admins delete. The reference a customer sees is
--     "W-" and the id padded to four digits (W-0042); it is computed, not stored.
--  2. workshop_job_events - every status change (and the request itself), who and when. Written
--     only by the trigger; staff read it.
--  3. workshop_request(p jsonb) - the website's form. Anyone may call it; it is metered per network
--     (_ip_gate 'workshop', 10 in 10 minutes) and checks every field again. A signed-in rider
--     (customer id + session token) is linked to the request. The same phone sending the same
--     service for the same day within ten minutes gets the same reference back (a double tap).
--  4. workshop_track(p_ref, p_phone) - the customer's status check: the reference plus the phone
--     it was booked with. Metered (_ip_gate 'wstrack', 30 in 10 minutes).
--
-- Rollback:
--   drop function if exists public.workshop_track(text, text);
--   drop function if exists public.workshop_request(jsonb);
--   drop function if exists public._workshop_log();
--   drop function if exists public._workshop_stamp();
--   drop table if exists public.workshop_job_events;
--   drop table if exists public.workshop_jobs;
-- Idempotent.
-- ============================================================================

begin;

create table if not exists public.workshop_jobs (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  customer_id     text references public.customers(id) on delete set null,
  name            text not null check (length(name) between 2 and 120),
  phone           text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email           text check (email is null or length(email) <= 254),
  service         text not null check (service ~ '^[a-z0-9_-]{1,40}$'),
  service_label   text check (service_label is null or length(service_label) <= 80),
  price_quoted    numeric(10,2) check (price_quoted is null or price_quoted between 0 and 100000),
  parts           jsonb not null default '[]'::jsonb check (jsonb_typeof(parts) = 'array' and jsonb_array_length(parts) <= 10),
  lane            text not null default 'dropoff' check (lane in ('dropoff','wait','pickup')),
  pickup_address  text check (pickup_address is null or length(pickup_address) <= 200),
  preferred_date  date,
  preferred_time  text check (preferred_time is null or preferred_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  bike            text check (bike is null or length(bike) <= 80),
  notes           text check (notes is null or length(notes) <= 600),
  lang            text not null default 'en' check (lang ~ '^[a-z]{2}$'),
  status          text not null default 'new' check (status in ('new','confirmed','in_workshop','awaiting_parts','ready','completed','cancelled')),
  scheduled_for   timestamptz,
  price_final     numeric(10,2) check (price_final is null or price_final between 0 and 100000),
  staff_notes     text check (staff_notes is null or length(staff_notes) <= 1000),
  updated_at      timestamptz not null default now(),
  updated_by      text check (updated_by is null or length(updated_by) <= 120)
);
create index if not exists workshop_jobs_status_created on public.workshop_jobs (status, created_at desc);
create index if not exists workshop_jobs_phone on public.workshop_jobs (phone);
create index if not exists workshop_jobs_customer on public.workshop_jobs (customer_id) where customer_id is not null;
alter table public.workshop_jobs enable row level security;

drop policy if exists "workshop staff read" on public.workshop_jobs;
create policy "workshop staff read" on public.workshop_jobs for select to authenticated using ((select public.is_staff()));
drop policy if exists "workshop staff insert" on public.workshop_jobs;
create policy "workshop staff insert" on public.workshop_jobs for insert to authenticated with check ((select public.is_staff()));
drop policy if exists "workshop staff update" on public.workshop_jobs;
create policy "workshop staff update" on public.workshop_jobs for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "workshop admin delete" on public.workshop_jobs;
create policy "workshop admin delete" on public.workshop_jobs for delete to authenticated using ((select public.is_admin()));
revoke all on public.workshop_jobs from anon;
grant select, insert, update, delete on public.workshop_jobs to authenticated;

create table if not exists public.workshop_job_events (
  id      bigint generated always as identity primary key,
  job_id  bigint not null references public.workshop_jobs(id) on delete cascade,
  at      timestamptz not null default now(),
  status  text not null,
  note    text,
  by      text
);
create index if not exists workshop_job_events_job on public.workshop_job_events (job_id, at);
alter table public.workshop_job_events enable row level security;
drop policy if exists "workshop events staff read" on public.workshop_job_events;
create policy "workshop events staff read" on public.workshop_job_events for select to authenticated using ((select public.is_staff()));
revoke all on public.workshop_job_events from anon, authenticated;
grant select on public.workshop_job_events to authenticated;

-- updated_at is the server's clock. updated_by is the operator name the staff page sends with
-- every change (the same person often makes several in a row, so an unchanged name is kept); a
-- change that names nobody is signed with the signed-in account's email.
create or replace function public._workshop_stamp()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and coalesce(new.updated_by, '') = '' then
    new.updated_by := left(coalesce(auth.jwt() ->> 'email', 'unknown'), 120);
  end if;
  return new;
end $function$;
revoke all on function public._workshop_stamp() from public, anon, authenticated;
drop trigger if exists workshop_stamp on public.workshop_jobs;
create trigger workshop_stamp before update on public.workshop_jobs
  for each row execute function public._workshop_stamp();

-- Definer: the events table has no write policy for anyone; only this trigger writes it.
create or replace function public._workshop_log()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.workshop_job_events(job_id, status, note, by) values (new.id, new.status, 'requested', coalesce(new.updated_by, 'website'));
  elsif new.status is distinct from old.status or new.scheduled_for is distinct from old.scheduled_for or new.price_final is distinct from old.price_final then
    insert into public.workshop_job_events(job_id, status, note, by)
    values (new.id, new.status,
      nullif(concat_ws(' · ',
        case when new.scheduled_for is distinct from old.scheduled_for then 'scheduled ' || coalesce(to_char(new.scheduled_for at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI'), 'cleared') end,
        case when new.price_final is distinct from old.price_final then 'price ' || coalesce(new.price_final::text, 'cleared') end), ''),
      new.updated_by);
  end if;
  return new;
end $function$;
revoke all on function public._workshop_log() from public, anon, authenticated;
drop trigger if exists workshop_log on public.workshop_jobs;
create trigger workshop_log after insert or update on public.workshop_jobs
  for each row execute function public._workshop_log();

create or replace function public.workshop_request(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_name    text := regexp_replace(trim(coalesce(p->>'name','')), '\s+', ' ', 'g');
  v_phone   text := trim(coalesce(p->>'phone',''));
  v_email   text := nullif(lower(trim(coalesce(p->>'email',''))), '');
  v_service text := coalesce(p->>'service','');
  v_label   text := nullif(trim(coalesce(p->>'service_label','')), '');
  v_price   numeric;
  v_parts   jsonb := coalesce(p->'parts', '[]'::jsonb);
  v_lane    text := coalesce(nullif(p->>'lane',''), 'dropoff');
  v_addr    text := nullif(trim(coalesce(p->>'pickup_address','')), '');
  v_date    date;
  v_time    text := nullif(p->>'preferred_time','');
  v_bike    text := nullif(trim(coalesce(p->>'bike','')), '');
  v_notes   text := nullif(trim(coalesce(p->>'notes','')), '');
  v_lang    text := coalesce(nullif(p->>'lang',''), 'en');
  v_cust    text;
  v_today   date := (now() at time zone 'Asia/Riyadh')::date;
  v_part    jsonb;
  v_prev    bigint;
  v_id      bigint;
begin
  if not _ip_gate('workshop', 10, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'error', 'throttled');
  end if;
  if v_name = '' or length(v_name) > 120 or not _name_chars_ok(v_name) then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' or (v_phone like '+966%' and v_phone !~ '^\+9665[0-9]{8}$') then
    return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$') then
    return jsonb_build_object('ok', false, 'error', 'email'); end if;
  if v_service !~ '^[a-z0-9_-]{1,40}$' then return jsonb_build_object('ok', false, 'error', 'service'); end if;
  if v_label is not null and (length(v_label) > 80 or v_label ~ '[<>`]') then return jsonb_build_object('ok', false, 'error', 'service'); end if;
  begin v_price := nullif(p->>'price','')::numeric; exception when others then v_price := null; end;
  if v_price is not null and (v_price < 0 or v_price > 100000) then v_price := null; end if;
  if jsonb_typeof(v_parts) <> 'array' or jsonb_array_length(v_parts) > 10 then return jsonb_build_object('ok', false, 'error', 'parts'); end if;
  for v_part in select * from jsonb_array_elements(v_parts) loop
    if jsonb_typeof(v_part) <> 'object' or coalesce(v_part->>'id','') !~ '^[a-z0-9_-]{1,40}$'
       or length(coalesce(v_part->>'label','')) > 80 or coalesce(v_part->>'label','') ~ '[<>`]' then
      return jsonb_build_object('ok', false, 'error', 'parts'); end if;
  end loop;
  if v_lane not in ('dropoff','wait','pickup') then return jsonb_build_object('ok', false, 'error', 'lane'); end if;
  if v_lane = 'pickup' and (v_addr is null or length(v_addr) > 200) then return jsonb_build_object('ok', false, 'error', 'pickup_address'); end if;
  if v_lane <> 'pickup' then v_addr := null; end if;
  if nullif(p->>'preferred_date','') is not null then
    begin v_date := (p->>'preferred_date')::date; exception when others then return jsonb_build_object('ok', false, 'error', 'date'); end;
    if v_date < v_today or v_date > v_today + 60 then return jsonb_build_object('ok', false, 'error', 'date'); end if;
  end if;
  if v_time is not null and v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return jsonb_build_object('ok', false, 'error', 'time'); end if;
  if v_bike is not null and length(v_bike) > 80 then return jsonb_build_object('ok', false, 'error', 'bike'); end if;
  if v_notes is not null and length(v_notes) > 600 then return jsonb_build_object('ok', false, 'error', 'notes'); end if;
  if v_lang !~ '^[a-z]{2}$' then v_lang := 'en'; end if;
  if coalesce(p->>'customer_id','') <> '' and coalesce(p->>'token','') <> '' and _cust_token_ok(p->>'customer_id', p->>'token') then
    v_cust := p->>'customer_id';
  end if;

  -- A double tap (or a retry after a lost answer) gets the same reference back.
  perform pg_advisory_xact_lock(hashtext('workshop:' || v_phone));
  select id into v_prev from workshop_jobs
   where phone = v_phone and service = v_service and preferred_date is not distinct from v_date
     and status = 'new' and created_at > now() - interval '10 minutes'
   order by id desc limit 1;
  if v_prev is not null then
    return jsonb_build_object('ok', true, 'id', v_prev, 'ref', 'W-' || lpad(v_prev::text, 4, '0'), 'repeat', true);
  end if;

  insert into workshop_jobs(customer_id, name, phone, email, service, service_label, price_quoted, parts, lane, pickup_address,
                            preferred_date, preferred_time, bike, notes, lang, updated_by)
  values (v_cust, v_name, v_phone, v_email, v_service, v_label, v_price, v_parts, v_lane, v_addr,
          v_date, v_time, v_bike, v_notes, v_lang, 'website')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'ref', 'W-' || lpad(v_id::text, 4, '0'));
end $function$;
revoke all on function public.workshop_request(jsonb) from public;
grant execute on function public.workshop_request(jsonb) to anon, authenticated;

create or replace function public.workshop_track(p_ref text, p_phone text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id bigint;
  v_digits text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 9);
  j workshop_jobs%rowtype;
begin
  if not _ip_gate('wstrack', 30, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'error', 'throttled');
  end if;
  if coalesce(p_ref,'') !~* '^\s*W-?0*([0-9]{1,9})\s*$' or length(v_digits) < 9 then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  v_id := (regexp_match(p_ref, '([0-9]{1,9})'))[1]::bigint;
  select * into j from workshop_jobs where id = v_id and right(regexp_replace(phone, '\D', '', 'g'), 9) = v_digits;
  if j.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'ref', 'W-' || lpad(j.id::text, 4, '0'), 'status', j.status,
    'service', j.service_label, 'preferred_date', j.preferred_date, 'preferred_time', j.preferred_time,
    'scheduled_for', j.scheduled_for, 'lane', j.lane, 'price', j.price_final);
end $function$;
revoke all on function public.workshop_track(text, text) from public;
grant execute on function public.workshop_track(text, text) to anon, authenticated;

commit;
