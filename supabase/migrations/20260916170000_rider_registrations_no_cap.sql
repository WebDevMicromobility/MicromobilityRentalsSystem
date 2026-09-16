-- ============================================================================
-- Partner registrations have no cap.
--
-- A session's capacity (35 on a Petromin Wednesday) limits bookings made on the
-- website. It was also limiting the registration form at micromobility.sa/petromin,
-- by two routes:
--   1. _session_fill_status closes a Petromin session itself once website bookings
--      reach capacity (marking bike_slots._ac so the close is known to be automatic),
--      and rider_sessions() only listed sessions whose status is 'open', so a full
--      Wednesday vanished from the form and rider_register() refused it.
--   2. rider_sessions() reported 'spots' (capacity minus website bookings) and the
--      form greyed a session out at zero.
--
-- From here on:
--   _rider_session_open(s)   true for 'open', for the legacy 'full', and for a
--                            'closed' that the fill rule made (bike_slots._ac). A
--                            close a person made still hides the session and still
--                            refuses a registration, as before.
--   rider_sessions()         uses it, and no longer returns 'spots' at all: the form
--                            gets no capacity signal to act on.
--   rider_register()         uses it in the session check; nothing else changes.
-- rider_registrations rows were never counted against capacity and still are not.
--
-- APPLIED TO PRODUCTION 2026-09-16 via the Supabase MCP (version 'rider_registrations_no_cap').
-- If the CLI lists this file as pending: supabase migration repair --status applied 20260916170000
-- Rollback: re-run the rider_sessions and rider_register definitions in
--           20260916160000_rider_registrations_sessions.sql, then
--           drop function if exists public._rider_session_open(public.sessions);
-- Idempotent. After running: supabase/checks/security-attributes.sql must print nothing.
-- ============================================================================

create or replace function public._rider_session_open(s public.sessions)
 returns boolean language plpgsql stable set search_path to 'public'
as $function$
declare _slots jsonb;
begin
  if s.status = 'open' or s.status = 'full' then return true; end if;
  if s.status <> 'closed' then return false; end if;
  begin
    _slots := coalesce(nullif(s.bike_slots,'')::jsonb, '{}'::jsonb);
  exception when others then _slots := '{}'::jsonb;
  end;
  return coalesce((_slots->>'_ac')::boolean, false);
end $function$;
revoke all on function public._rider_session_open(public.sessions) from public, anon, authenticated;

create or replace function public.rider_sessions(p_source text default 'petromin')
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_kind text := lower(regexp_replace(coalesce(p_source,''), '[^a-zA-Z0-9_-]', '', 'g'));
        v_today text := to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'title', s.title,
             'start', to_char(w.starts_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD"T"HH24:MI:SS') || '+03:00',
             'end',   to_char(w.ends_at   at time zone 'Asia/Riyadh', 'YYYY-MM-DD"T"HH24:MI:SS') || '+03:00'
           ) order by s.session_date)
    from sessions s cross join lateral _session_window(s) w
    where s.ride_kind = v_kind and _rider_session_open(s) and s.session_date >= v_today and w.ends_at > now()
  ), '[]'::jsonb);
end $function$;
revoke all on function public.rider_sessions(text) from public;
grant execute on function public.rider_sessions(text) to anon, authenticated;

create or replace function public.rider_register(p_badge text, p_name text, p_height integer, p_type text, p_source text default null, p_phone text default null, p_session_id text default null, p_company text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_badge text := trim(coalesce(p_badge,''));
  v_name  text := regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g');
  v_type  text := coalesce(p_type,'');
  v_src   text := coalesce(nullif(left(lower(regexp_replace(coalesce(p_source,''), '[^a-zA-Z0-9_-]', '', 'g')), 40), ''), 'petromin');
  v_company text := nullif(trim(coalesce(p_company,'')), '');
  v_digits text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v_phone text; v_last9 text;
  v_today text := to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD');
  v_sess sessions%rowtype; v_win record;
  v_entry queue_entries%rowtype;
  v_cust_id text; v_kind text := 'none';
  v_id bigint; v_n int; v_bno text; v_seq int;
begin
  if not _rider_gate() then return jsonb_build_object('ok', false, 'error', 'throttled'); end if;
  if v_badge = '' or length(v_badge) > 40 then return jsonb_build_object('ok', false, 'error', 'badge'); end if;
  if v_name = '' or length(v_name) > 120 or v_name !~ '\s' then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if p_height is null or p_height < 100 or p_height > 250 then return jsonb_build_object('ok', false, 'error', 'height'); end if;
  if v_type not in ('Road','Hybrid','Mountain') then return jsonb_build_object('ok', false, 'error', 'type'); end if;
  if v_company is not null and v_company not in ('Petromin','Petrolube') then return jsonb_build_object('ok', false, 'error', 'company'); end if;

  if p_session_id is not null then
    select * into v_sess from sessions where id = p_session_id;
    if v_sess.id is null or not _rider_session_open(v_sess) or v_sess.ride_kind is distinct from v_src or v_sess.session_date < v_today then
      return jsonb_build_object('ok', false, 'error', 'session');
    end if;
    select * into v_win from _session_window(v_sess);
    if v_win.ends_at <= now() then return jsonb_build_object('ok', false, 'error', 'session'); end if;
  end if;

  if v_digits <> '' then
    if v_digits ~ '^009665\d{8}$' then v_digits := substr(v_digits, 3); end if;
    if v_digits ~ '^05\d{8}$' then v_phone := '+966' || substr(v_digits, 2);
    elsif v_digits ~ '^5\d{8}$' then v_phone := '+966' || v_digits;
    elsif v_digits ~ '^9665\d{8}$' then v_phone := '+' || v_digits;
    elsif coalesce(p_phone,'') ~ '^\+\d{8,15}$' then v_phone := p_phone;
    else return jsonb_build_object('ok', false, 'error', 'phone');
    end if;
    v_last9 := right(v_phone, 9);
  end if;

  if v_sess.id is not null and v_last9 is not null then
    select * into v_entry from queue_entries q where q.session_id = v_sess.id and q.status in ('waiting','waitlist','active')
      and right(regexp_replace(coalesce(q.phone,''), '\D', '', 'g'), 9) = v_last9 order by q.queue_num limit 1;
  end if;
  if v_entry.id is null and v_sess.id is not null then
    select * into v_entry from queue_entries q where q.session_id = v_sess.id and q.status in ('waiting','waitlist','active')
      and lower(regexp_replace(trim(q.name), '\s+', ' ', 'g')) = lower(v_name) order by q.queue_num limit 1;
  end if;
  if v_entry.id is null and v_last9 is not null then
    select * into v_entry from queue_entries q where q.status in ('waiting','waitlist','active') and q.session_date >= v_today
      and right(regexp_replace(coalesce(q.phone,''), '\D', '', 'g'), 9) = v_last9 order by q.session_date, q.queue_num limit 1;
  end if;
  if v_entry.id is null then
    select * into v_entry from queue_entries q where q.status in ('waiting','waitlist','active') and q.session_date >= v_today
      and lower(regexp_replace(trim(q.name), '\s+', ' ', 'g')) = lower(v_name) order by q.session_date, q.queue_num limit 1;
  end if;
  if v_entry.id is not null then
    v_kind := 'booking'; v_cust_id := v_entry.customer_id;
  else
    if v_last9 is not null then
      select id into v_cust_id from customers where right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 9) = v_last9 order by created_at desc limit 1;
    end if;
    if v_cust_id is null then
      select id into v_cust_id from customers where lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower(v_name) order by created_at desc limit 1;
    end if;
    if v_cust_id is not null then v_kind := 'customer'; end if;
  end if;

  select booking_no into v_bno from rider_registrations
   where badge_key = lower(regexp_replace(v_badge, '[^a-zA-Z0-9]', '', 'g')) and coalesce(session_id,'') = coalesce(v_sess.id,'');
  if v_bno is null then
    insert into rider_booking_counters(source, n) values (v_src, 1)
      on conflict (source) do update set n = rider_booking_counters.n + 1 returning n into v_seq;
    v_bno := left(v_src, 1) || '-' || lpad(v_seq::text, 3, '0');
  end if;

  insert into rider_registrations (badge, name, phone, height, type_preference, matched_entry_id, matched_customer_id, match_kind, source, session_id, company, booking_no)
  values (v_badge, v_name, v_phone, p_height, v_type, v_entry.id, v_cust_id, v_kind, v_src, v_sess.id, v_company, v_bno)
  on conflict (badge_key, coalesce(session_id,'')) do update
    set name = excluded.name, phone = coalesce(excluded.phone, rider_registrations.phone),
        height = excluded.height, type_preference = excluded.type_preference,
        matched_entry_id = excluded.matched_entry_id, matched_customer_id = excluded.matched_customer_id,
        match_kind = excluded.match_kind, source = coalesce(excluded.source, rider_registrations.source),
        company = coalesce(excluded.company, rider_registrations.company),
        submissions = rider_registrations.submissions + 1, updated_at = now()
  returning id, submissions into v_id, v_n;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'match', v_kind, 'resubmitted', v_n > 1, 'booking_no', v_bno,
    'session', case when v_sess.id is not null then jsonb_build_object('id', v_sess.id, 'title', v_sess.title,
        'start', to_char(v_win.starts_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD"T"HH24:MI:SS') || '+03:00',
        'end',   to_char(v_win.ends_at   at time zone 'Asia/Riyadh', 'YYYY-MM-DD"T"HH24:MI:SS') || '+03:00') end,
    'booking', case when v_kind = 'booking' then jsonb_build_object(
        'queue_num', v_entry.queue_num, 'session_date', v_entry.session_date, 'size', v_entry.size, 'type', v_entry.type_preference) end);
end $function$;
revoke all on function public.rider_register(text,text,integer,text,text,text,text,text) from public;
grant execute on function public.rider_register(text,text,integer,text,text,text,text,text) to anon, authenticated;
