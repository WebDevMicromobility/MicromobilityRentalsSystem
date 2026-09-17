-- ============================================================================
-- A companion's fields are optional at the desk.
--
-- Staff add companions in a hurry, often knowing only that someone is there. So on a
-- companion (party_no 2 and up) the name, height and bike type may be left blank:
--   name    defaults to the employee's first name and the rider's number ("Amal 3")
--   type    defaults to the employee's bike type
--   height  may stay unknown (the column loses NOT NULL; the desk sizes the bike by eye)
-- Whatever is given is still checked as before. The employee's own row is unchanged: the
-- public form requires every field client-side, so nothing changes for a rider signing up.
--
-- rider_register() and rider_party_add() are otherwise 20260916210000 and 20260917110000.
--
-- APPLIED TO PRODUCTION 2026-09-17 via the Supabase MCP (version 'rider_companions_optional').
-- If the CLI lists this file as pending: supabase migration repair --status applied 20260917120000
-- Rollback: re-run those two definitions; the column can stay nullable.
-- Idempotent. After running: supabase/checks/security-attributes.sql must print nothing.
-- ============================================================================

alter table public.rider_registrations alter column height drop not null;

create or replace function public.rider_register(p_badge text, p_name text, p_height integer, p_type text, p_source text default null, p_phone text default null, p_session_id text default null, p_company text default null, p_riders jsonb default null)
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
  v_riders jsonb; v_n_extra int := 0; v_i int; v_c jsonb; v_cname text; v_ch int; v_ctype text;
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

  -- Companions on the same booking: [{name, height, type}, ...], up to four. They ride under
  -- the employee's badge and booking number, each on their own row (own bike, own check-in,
  -- own price at return). Checked before anything is written, so a slip in rider 3 refuses
  -- the whole submission and leaves the rows as they were.
  v_riders := case when p_riders is not null and jsonb_typeof(p_riders) = 'array' then p_riders else '[]'::jsonb end;
  v_n_extra := jsonb_array_length(v_riders);
  if v_n_extra > 4 then return jsonb_build_object('ok', false, 'error', 'riders'); end if;
  for v_i in 0 .. v_n_extra - 1 loop
    v_c := v_riders -> v_i;
    v_cname := regexp_replace(trim(coalesce(v_c->>'name','')), '\s+', ' ', 'g');
    v_ch := nullif(regexp_replace(coalesce(v_c->>'height',''), '\D', '', 'g'), '')::int;
    v_ctype := coalesce(v_c->>'type','');
    -- A companion's fields are optional: the desk adds people in a hurry. A blank name becomes
    -- the employee's first name and the rider's number, a blank type follows the employee's,
    -- a blank height stays unknown (the desk sizes the bike by eye). What is given is checked.
    if v_cname = '' then v_cname := split_part(v_name, ' ', 1) || ' ' || (v_i + 2)::text; end if;
    if length(v_cname) > 120 then return jsonb_build_object('ok', false, 'error', 'rider_name', 'rider', v_i + 2); end if;
    if v_ch is not null and (v_ch < 100 or v_ch > 250) then return jsonb_build_object('ok', false, 'error', 'rider_height', 'rider', v_i + 2); end if;
    if v_ctype = '' then v_ctype := v_type; end if;
    if v_ctype not in ('Road','Hybrid','Mountain') then return jsonb_build_object('ok', false, 'error', 'rider_type', 'rider', v_i + 2); end if;
    v_riders := jsonb_set(v_riders, array[v_i::text], jsonb_build_object('name', v_cname, 'height', v_ch, 'type', v_ctype));
  end loop;

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
   where badge_key = lower(regexp_replace(v_badge, '[^a-zA-Z0-9]', '', 'g')) and coalesce(session_id,'') = coalesce(v_sess.id,'') and party_no = 1;
  if v_bno is null then
    insert into rider_booking_counters(source, n) values (v_src, 1)
      on conflict (source) do update set n = rider_booking_counters.n + 1 returning n into v_seq;
    v_bno := upper(left(v_src, 1)) || '-' || lpad(v_seq::text, 3, '0');
  end if;

  insert into rider_registrations (badge, name, phone, height, type_preference, matched_entry_id, matched_customer_id, match_kind, source, session_id, company, booking_no, party_no)
  values (v_badge, v_name, v_phone, p_height, v_type, v_entry.id, v_cust_id, v_kind, v_src, v_sess.id, v_company, v_bno, 1)
  on conflict (badge_key, coalesce(session_id,''), party_no) do update
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

  -- The companions, rows 2..N of the same booking.
  for v_i in 0 .. v_n_extra - 1 loop
    v_c := v_riders -> v_i;
    v_cname := regexp_replace(trim(coalesce(v_c->>'name','')), '\s+', ' ', 'g');
    v_ch := nullif(regexp_replace(coalesce(v_c->>'height',''), '\D', '', 'g'), '')::int;
    v_ctype := coalesce(v_c->>'type','');
    insert into rider_registrations (badge, name, phone, height, type_preference, matched_entry_id, matched_customer_id, match_kind, source, session_id, company, booking_no, party_no)
    values (v_badge, v_cname, null, v_ch, v_ctype, null, null, 'none', v_src, v_sess.id, v_company, v_bno, v_i + 2)
    on conflict (badge_key, coalesce(session_id,''), party_no) do update
      set name = excluded.name,
          height          = case when rider_registrations.checked_out_at is null then excluded.height          else rider_registrations.height          end,
          type_preference = case when rider_registrations.checked_out_at is null then excluded.type_preference else rider_registrations.type_preference end,
          company = coalesce(excluded.company, rider_registrations.company),
          booking_no = coalesce(rider_registrations.booking_no, excluded.booking_no),
          submissions = rider_registrations.submissions + 1, updated_at = now();
  end loop;
  -- Companions left off a resubmission go, unless the desk has already checked them in.
  delete from rider_registrations
   where badge_key = lower(regexp_replace(v_badge, '[^a-zA-Z0-9]', '', 'g')) and coalesce(session_id,'') = coalesce(v_sess.id,'')
     and party_no > v_n_extra + 1 and checked_in_at is null;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'match', v_kind, 'resubmitted', v_n > 1, 'booking_no', v_bno, 'riders', v_n_extra + 1,
    'session', case when v_sess.id is not null then jsonb_build_object('id', v_sess.id, 'title', v_sess.title,
        'start', to_char(v_win.starts_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD"T"HH24:MI:SS') || '+03:00',
        'end',   to_char(v_win.ends_at   at time zone 'Asia/Riyadh', 'YYYY-MM-DD"T"HH24:MI:SS') || '+03:00') end,
    'booking', case when v_kind = 'booking' then jsonb_build_object(
        'queue_num', v_entry.queue_num, 'session_date', v_entry.session_date, 'size', v_entry.size, 'type', v_entry.type_preference) end);
end $function$;
drop function if exists public.rider_register(text,text,integer,text,text,text,text,text);
revoke all on function public.rider_register(text,text,integer,text,text,text,text,text,jsonb) from public;
grant execute on function public.rider_register(text,text,integer,text,text,text,text,text,jsonb) to anon, authenticated;

create or replace function public.rider_party_add(p_id bigint, p_riders jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_row rider_registrations%rowtype;
  v_n int; v_next int; v_i int; v_c jsonb; v_name text; v_h int; v_type text; v_id bigint;
  v_ids bigint[] := '{}';
begin
  if not is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  select * into v_row from rider_registrations where id = p_id;
  if v_row.id is null or v_row.booking_no is null then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  -- the employee's row anchors the party
  select * into v_row from rider_registrations where booking_no = v_row.booking_no and party_no = 1;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  if p_riders is null or jsonb_typeof(p_riders) <> 'array' then return jsonb_build_object('ok', false, 'error', 'riders'); end if;
  perform pg_advisory_xact_lock(hashtext('rider-party:' || v_row.booking_no));
  select count(*), coalesce(max(party_no), 1) into v_n, v_next from rider_registrations where booking_no = v_row.booking_no;
  if v_n + jsonb_array_length(p_riders) > 5 then return jsonb_build_object('ok', false, 'error', 'riders'); end if;
  for v_i in 0 .. jsonb_array_length(p_riders) - 1 loop
    v_c := p_riders -> v_i;
    v_name := regexp_replace(trim(coalesce(v_c->>'name','')), '\s+', ' ', 'g');
    v_h := nullif(regexp_replace(coalesce(v_c->>'height',''), '\D', '', 'g'), '')::int;
    v_type := coalesce(v_c->>'type','');
    -- Optional fields, as in rider_register(): a blank name is the employee's first name and
    -- the rider's number, a blank type follows the employee's, a blank height stays unknown.
    if v_name = '' then v_name := split_part(coalesce(v_row.name,''), ' ', 1) || ' ' || (v_next + 1)::text; end if;
    if length(v_name) > 120 then return jsonb_build_object('ok', false, 'error', 'rider_name', 'rider', v_next + 1); end if;
    if v_h is not null and (v_h < 100 or v_h > 250) then return jsonb_build_object('ok', false, 'error', 'rider_height', 'rider', v_next + 1); end if;
    if v_type = '' then v_type := coalesce(v_row.type_preference, 'Hybrid'); end if;
    if v_type not in ('Road','Hybrid','Mountain') then return jsonb_build_object('ok', false, 'error', 'rider_type', 'rider', v_next + 1); end if;
    v_next := v_next + 1;
    insert into rider_registrations (badge, name, phone, height, type_preference, matched_entry_id, matched_customer_id, match_kind, source, session_id, company, booking_no, party_no)
    values (v_row.badge, v_name, v_row.phone, v_h, v_type, null, null, 'none', v_row.source, v_row.session_id, v_row.company, v_row.booking_no, v_next)
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  return jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'riders', v_next);
end $function$;
revoke all on function public.rider_party_add(bigint, jsonb) from public, anon;
grant execute on function public.rider_party_add(bigint, jsonb) to authenticated;
