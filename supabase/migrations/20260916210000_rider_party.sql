-- ============================================================================
-- One registration, several riders: a Petromin employee brings companions.
--
-- The form at micromobility.sa/petromin sends the employee's details as before plus
-- p_riders, a JSON array of companions [{name, height, type}, ...] (up to four). Each
-- companion becomes a row of their own under the SAME badge and booking number, numbered
-- party_no 2..N, so the desk checks each rider in, hands each a bike and prices each at
-- return exactly as today. A resubmission updates the companions in place and drops any
-- left off, unless the desk has already checked them in.
--
--   rider_registrations.party_no   1 = the employee, 2.. = companions
--   unique (badge_key, session, party_no)   was (badge_key, session)
--   unique (booking_no, party_no)           was (booking_no)
--   rider_register(..., p_riders)           9 arguments; the 8-argument one is dropped so
--                                           PostgREST has one overload to resolve
--   rider_edit(..., p_riders)               10 arguments, same; moves the whole party
--
-- What the form must send (unchanged fields omitted):
--   rider_register({ ..., p_riders: [{ name: 'Sara Ali', height: 165, type: 'Hybrid' }] })
--   -> { ok: true, booking_no: 'P-042', riders: 2, ... }
--   errors: 'riders' (more than four), 'rider_name' / 'rider_height' / 'rider_type' with
--   'rider': N (which one, counting the employee as 1)
--
-- NOT YET APPLIED TO PRODUCTION. Apply via the Supabase MCP (apply_migration) or the CLI;
-- the dashboard SQL editor is the fallback while `supabase db push` is blocked by history
-- drift. Then: supabase migration repair --status applied 20260916210000
-- After running: supabase/checks/security-attributes.sql must print nothing.
-- Rollback: re-run 20260916200000 (rider_register) and 20260916191500 (rider_edit); the
-- column and the two indexes can stay.
-- ============================================================================

alter table public.rider_registrations add column if not exists party_no integer not null default 1;

drop index if exists public.rider_registrations_badge_session;
create unique index rider_registrations_badge_session
  on public.rider_registrations (badge_key, coalesce(session_id, ''), party_no);
drop index if exists public.rider_registrations_booking_no;
create unique index rider_registrations_booking_no
  on public.rider_registrations (booking_no, party_no);

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
    if v_cname = '' or length(v_cname) > 120 then return jsonb_build_object('ok', false, 'error', 'rider_name', 'rider', v_i + 2); end if;
    if v_ch is null or v_ch < 100 or v_ch > 250 then return jsonb_build_object('ok', false, 'error', 'rider_height', 'rider', v_i + 2); end if;
    if v_ctype not in ('Road','Hybrid','Mountain') then return jsonb_build_object('ok', false, 'error', 'rider_type', 'rider', v_i + 2); end if;
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

create or replace function public.rider_edit(p_booking_no text, p_proof_phone text, p_badge text, p_name text, p_height integer, p_type text, p_session_id text default null, p_company text default null, p_phone text default null, p_riders jsonb default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_row rider_registrations%rowtype;
  v_proof text := right(regexp_replace(coalesce(p_proof_phone,''), '\D', '', 'g'), 9);
  v_newkey text := lower(regexp_replace(trim(coalesce(p_badge,'')), '[^a-zA-Z0-9]', '', 'g'));
  v_sess_id text;
  v_r jsonb;
begin
  if not _rider_gate() then return jsonb_build_object('ok', false, 'error', 'throttled'); end if;

  select * into v_row from rider_registrations where upper(booking_no) = upper(trim(coalesce(p_booking_no,''))) and party_no = 1;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  if v_row.phone is null or length(v_proof) < 9 or right(regexp_replace(v_row.phone, '\D', '', 'g'), 9) <> v_proof then
    return jsonb_build_object('ok', false, 'error', 'notfound');
  end if;
  if v_row.checked_in_at is not null then return jsonb_build_object('ok', false, 'error', 'checked_in'); end if;

  v_sess_id := coalesce(p_session_id, v_row.session_id);
  if v_newkey = '' then return jsonb_build_object('ok', false, 'error', 'badge'); end if;
  if exists (select 1 from rider_registrations r
              where r.badge_key = v_newkey and coalesce(r.session_id,'') = coalesce(v_sess_id,'') and r.booking_no is distinct from v_row.booking_no) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  -- Sub-transaction: move the row under the new badge and session, then let rider_register()
  -- validate and upsert onto it (same badge_key + session_id, so booking_no is kept). A refusal
  -- is raised out of the block so the moves roll back with it.
  begin
    update rider_registrations
       set badge = trim(p_badge), session_id = v_sess_id
     where booking_no = v_row.booking_no;   -- the whole party moves together
    v_r := rider_register(p_badge, p_name, p_height, p_type, coalesce(v_row.source, 'petromin'), p_phone, v_sess_id, p_company, p_riders);
    if not coalesce((v_r->>'ok')::boolean, false) then
      raise exception using errcode = 'MM001', message = v_r::text;
    end if;
  exception when sqlstate 'MM001' then
    return sqlerrm::jsonb;
  end;

  return v_r;
end $function$;
drop function if exists public.rider_edit(text,text,text,text,integer,text,text,text,text);
revoke all on function public.rider_edit(text,text,text,text,integer,text,text,text,text,jsonb) from public;
grant execute on function public.rider_edit(text,text,text,text,integer,text,text,text,text,jsonb) to anon, authenticated;
