-- ============================================================================
-- Review fixes, 2026-09-16: the Petromin fill rule writes 'full', and
-- rider_register() keeps what was ridden and the number it issued.
--
-- rider_register(): (1) the number lookup, the mint and the upsert now run under one
-- advisory lock per badge+session, and the conflict branch carries booking_no, so two
-- submissions racing for the same badge (the rider's phone and the desk walk-in) get one
-- number and the caller is told the number the row really holds; (2) once the bike is
-- back, a resubmission no longer changes height or type_preference (the price was fixed
-- at return from the type ridden); (3) once checked in, a resubmission no longer
-- re-points matched_entry_id. Everything else is 20260916193000 verbatim.
--
-- _session_fill_status(): see the block below.
--
-- NOT YET APPLIED TO PRODUCTION. Run in the SQL editor, then:
--   supabase migration repair --status applied 20260916200000
-- After running: supabase/checks/security-attributes.sql must print nothing.
-- Rollback: re-run 20260916193000 (rider_register) and 20260916190000 (_session_fill_status).
-- ============================================================================

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
  -- v_win is only filled when a session is given, but the RETURN below names its fields in
  -- both branches of a CASE, and plpgsql refuses a never-assigned record outright. Give it
  -- its shape up front so a registration without a session returns instead of erroring.
  select null::timestamptz as starts_at, null::timestamptz as ends_at into v_win;
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

  -- One number per badge+session, even when two submissions race (the rider's phone and the
  -- desk walk-in): the lookup, the mint and the upsert run under one lock for that key.
  perform pg_advisory_xact_lock(hashtext('rider:' || lower(regexp_replace(v_badge, '[^a-zA-Z0-9]', '', 'g')) || ':' || coalesce(v_sess.id,'')));
  select booking_no into v_bno from rider_registrations
   where badge_key = lower(regexp_replace(v_badge, '[^a-zA-Z0-9]', '', 'g')) and coalesce(session_id,'') = coalesce(v_sess.id,'');
  if v_bno is null then
    insert into rider_booking_counters(source, n) values (v_src, 1)
      on conflict (source) do update set n = rider_booking_counters.n + 1 returning n into v_seq;
    v_bno := upper(left(v_src, 1)) || '-' || lpad(v_seq::text, 3, '0');
  end if;

  insert into rider_registrations (badge, name, phone, height, type_preference, matched_entry_id, matched_customer_id, match_kind, source, session_id, company, booking_no)
  values (v_badge, v_name, v_phone, p_height, v_type, v_entry.id, v_cust_id, v_kind, v_src, v_sess.id, v_company, v_bno)
  on conflict (badge_key, coalesce(session_id,'')) do update
    set name = excluded.name, phone = coalesce(excluded.phone, rider_registrations.phone),
        -- What was ridden is what is billed: once the bike is back, the type and height stay.
        height          = case when rider_registrations.checked_out_at is null then excluded.height          else rider_registrations.height          end,
        type_preference = case when rider_registrations.checked_out_at is null then excluded.type_preference else rider_registrations.type_preference end,
        -- The desk's link outranks a re-match: a checked-in row keeps the booking it was checked in against.
        matched_entry_id    = case when rider_registrations.checked_in_at is null then excluded.matched_entry_id    else rider_registrations.matched_entry_id    end,
        matched_customer_id = case when rider_registrations.checked_in_at is null then excluded.matched_customer_id else rider_registrations.matched_customer_id end,
        match_kind          = case when rider_registrations.checked_in_at is null then excluded.match_kind          else rider_registrations.match_kind          end,
        source = coalesce(excluded.source, rider_registrations.source),
        company = coalesce(excluded.company, rider_registrations.company),
        -- A row that predates numbering takes the one minted now; one that has a number keeps it.
        booking_no = coalesce(rider_registrations.booking_no, excluded.booking_no),
        submissions = rider_registrations.submissions + 1, updated_at = now()
  returning id, submissions, booking_no into v_id, v_n, v_bno;

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

-- ── The Petromin fill rule marks Fully Booked like every other ride ──────────
-- It used to write 'closed' plus an _ac marker in bike_slots so it could tell its own close
-- from a person's. Every reader of a session's status except one treated that 'closed' as
-- history: the customer wizard hid the night (no waitlist), the staff pickers and tonight's
-- default skipped it, the session editor dropped the marker and stranded it closed, and a
-- person's Close carrying a stale marker was undone by the rule. 'full' is a status all of
-- them already understand. Own-bike riders still count on the Petromin ride.
CREATE OR REPLACE FUNCTION public._session_fill_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _sid text; _cap int; _live int; _appr boolean; _st text; _petro boolean;
begin
  _sid := coalesce(new.session_id, old.session_id);
  if _sid is null then return null; end if;

  select coalesce(s.capacity,12), coalesce(s.needs_approval,false), coalesce(s.status,''),
         (coalesce(s.event_kind,'') = 'community' and coalesce(s.ride_kind,'') = 'petromin')
    into _cap, _appr, _st, _petro
    from sessions s where s.id = _sid;

  -- No such session, an approval ride, or one a person deliberately closed.
  if not found or _appr or _st = 'closed' then return null; end if;

  -- Exactly _capacity_guard's count: waitlist rows included, own-bike riders too on the
  -- Petromin ride.
  select count(*) into _live
    from queue_entries q
   where q.session_id = _sid
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and (_petro or coalesce(q.type_preference,'') <> 'Own');

  if _live >= _cap and _st <> 'full' then
    update sessions set status = 'full' where id = _sid;
  elsif _live < _cap and _st <> 'open' then
    update sessions set status = 'open' where id = _sid;
  end if;

  return null;
end $function$;

-- Sessions the old rule closed itself become Fully Booked, and the marker goes.
update sessions s
   set status = 'full',
       bike_slots = (nullif(s.bike_slots,'')::jsonb - '_ac')::text
 where coalesce(s.status,'') = 'closed'
   and coalesce((nullif(s.bike_slots,'')::jsonb ->> '_ac')::boolean, false);
-- A stale marker on any other row (a person's Open or Close after an auto-close) goes too.
update sessions s
   set bike_slots = (nullif(s.bike_slots,'')::jsonb - '_ac')::text
 where nullif(s.bike_slots,'') is not null
   and (nullif(s.bike_slots,'')::jsonb ? '_ac');
