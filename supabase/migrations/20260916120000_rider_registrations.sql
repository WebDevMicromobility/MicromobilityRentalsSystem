-- ============================================================================
-- Rider self-registration (the form at micromobility.sa/petromin).
--
-- A visitor opens the partner path and types badge number,
-- full name, height and bike type. The row lands here and is matched against the
-- open bookings (queue_entries) and the customer list by name, so staff can see who
-- turned up, whether they already have a booking, and whether what they typed
-- disagrees with what they booked (size / type).
--
--   rider_registrations   one row per badge (re-submitting the same badge updates it)
--   rider_register()      the only write path for the public: SECURITY DEFINER RPC,
--                         validates, throttles per IP, matches, upserts, returns a verdict
--
-- Public gets EXECUTE on the RPC and nothing else. Reading the table is staff-only
-- (is_staff()), same model as bike_assignments / staff_options.
-- Rollback: drop function if exists public.rider_register(text,text,integer,text,text);
--           drop table if exists public.rider_registrations;
-- Idempotent: safe to re-run.
-- APPLIED TO PRODUCTION 2026-09-16 via the Supabase MCP (as versions 'rider_registrations' and
-- 'rider_registrations_badge_key_alnum'). This file is the consolidated record; if the CLI
-- reports it as pending, mark it: supabase migration repair --status applied 20260916120000
-- ============================================================================

create table if not exists public.rider_registrations (
  id                  bigint generated always as identity primary key,
  badge               text not null,
  badge_key           text not null generated always as (lower(regexp_replace(badge, '[^a-zA-Z0-9]', '', 'g'))) stored, -- 'A-12', 'a 12', 'A12' are one badge
  name                text not null,
  height              integer not null check (height between 100 and 250),
  type_preference     text not null check (type_preference in ('Road','Hybrid','Mountain')),
  matched_entry_id    text references public.queue_entries(id) on delete set null,
  matched_customer_id text references public.customers(id) on delete set null,
  match_kind          text not null default 'none' check (match_kind in ('booking','customer','none')),
  submissions         integer not null default 1,          -- how many times this badge submitted
  source              text,                                  -- which partner path the form was served from ('petromin', ...)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists rider_registrations_badge_key on public.rider_registrations(badge_key);
create index if not exists rider_registrations_created_at on public.rider_registrations(created_at desc);

alter table public.rider_registrations enable row level security;
drop policy if exists "staff read"   on public.rider_registrations;
drop policy if exists "staff update" on public.rider_registrations;
drop policy if exists "staff delete" on public.rider_registrations;
create policy "staff read"   on public.rider_registrations for select using ((select is_staff()));
create policy "staff update" on public.rider_registrations for update using ((select is_staff())) with check ((select is_staff()));
create policy "staff delete" on public.rider_registrations for delete using ((select is_staff()));
-- No insert policy on purpose: the public writes only through rider_register().
revoke all on public.rider_registrations from public, anon;
grant select, update, delete on public.rider_registrations to authenticated;

-- Per-IP meter for the public RPC. Separate prefix and a much looser budget than
-- _oracle_gate(): a whole pop-up shares one venue Wi-Fi address, so 30/5min would
-- lock real riders out. 300 per 10 minutes per IP still stops a script.
create or replace function public._rider_gate()
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare ip text; k text; thr login_throttle%rowtype; n int;
begin
  begin
    ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for','?'), ',', 1);
  exception when others then ip := '?';
  end;
  k := 'rider:' || left(trim(ip), 60);
  select * into thr from login_throttle where identifier = k;
  if thr.locked_until is not null and thr.locked_until > now() then return false; end if;
  n := (case when thr.locked_until is not null and thr.locked_until <= now() then 0
             else coalesce(thr.fails, 0) end) + 1;
  insert into login_throttle(identifier, fails, locked_until)
    values (k, n, case when n >= 300 then now() + interval '10 minutes' else null end)
    on conflict (identifier) do update set fails = excluded.fails, locked_until = excluded.locked_until;
  return true;
end $function$;
revoke all on function public._rider_gate() from public, anon, authenticated;

create or replace function public.rider_register(p_badge text, p_name text, p_height integer, p_type text, p_source text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_badge text := trim(coalesce(p_badge,''));
  v_name  text := regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g');
  v_type  text := coalesce(p_type,'');
  v_src   text := nullif(left(lower(regexp_replace(coalesce(p_source,''), '[^a-zA-Z0-9_-]', '', 'g')), 40), '');
  v_today text := to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD');
  v_entry queue_entries%rowtype;
  v_cust_id text;
  v_kind text := 'none';
  v_id bigint;
  v_n int;
begin
  if not _rider_gate() then
    return jsonb_build_object('ok', false, 'error', 'throttled');
  end if;
  if v_badge = '' or length(v_badge) > 40 then return jsonb_build_object('ok', false, 'error', 'badge'); end if;
  if v_name = '' or length(v_name) > 120 or v_name !~ '\s' then return jsonb_build_object('ok', false, 'error', 'name'); end if; -- full name = at least two words
  if p_height is null or p_height < 100 or p_height > 250 then return jsonb_build_object('ok', false, 'error', 'height'); end if;
  if v_type not in ('Road','Hybrid','Mountain') then return jsonb_build_object('ok', false, 'error', 'type'); end if;

  -- 1. An open booking under that name, today or upcoming, nearest first.
  select * into v_entry from queue_entries
   where lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower(v_name)
     and status in ('waiting','waitlist','active')
     and session_date >= v_today
   order by session_date, queue_num
   limit 1;
  if found then
    v_kind := 'booking';
    v_cust_id := v_entry.customer_id;
  else
    -- 2. Otherwise a known customer under that name (no booking yet).
    select id into v_cust_id from customers
     where lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower(v_name)
     order by created_at desc limit 1;
    if found then v_kind := 'customer'; end if;
  end if;

  insert into rider_registrations (badge, name, height, type_preference, matched_entry_id, matched_customer_id, match_kind, source)
  values (v_badge, v_name, p_height, v_type, v_entry.id, v_cust_id, v_kind, v_src)
  on conflict (badge_key) do update
    set name = excluded.name, height = excluded.height, type_preference = excluded.type_preference,
        matched_entry_id = excluded.matched_entry_id, matched_customer_id = excluded.matched_customer_id,
        match_kind = excluded.match_kind, source = coalesce(excluded.source, rider_registrations.source),
        submissions = rider_registrations.submissions + 1, updated_at = now()
  returning id, submissions into v_id, v_n;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'match', v_kind, 'resubmitted', v_n > 1,
    'booking', case when v_kind = 'booking' then jsonb_build_object(
        'queue_num', v_entry.queue_num, 'session_date', v_entry.session_date,
        'size', v_entry.size, 'type', v_entry.type_preference) end);
end $function$;
revoke all on function public.rider_register(text,text,integer,text,text) from public;
grant execute on function public.rider_register(text,text,integer,text,text) to anon, authenticated;

-- Staff devices repaint when a rider submits (the app subscribes to postgres_changes).
do $$ begin
  alter publication supabase_realtime add table public.rider_registrations;
exception when duplicate_object then null; end $$;

-- After running: supabase/checks/security-attributes.sql must print nothing.
-- Verify: select badge, name, height, type_preference, match_kind, source from rider_registrations order by updated_at desc limit 20;
