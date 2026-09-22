-- Petromin booking numbers start again at P-001 every night (asked for 2026-09-22).
--
-- Numbers used to come from one counter per source (P-001 … P-050 across every night so far).
-- Each night now has its own counter, so a booking number is unique only within its night:
--   * rider_night_counters (session_key, source) → n, seeded from the numbers already given out,
--     so a night that has registrations carries on from its highest number and a new night
--     starts at 1. The old rider_booking_counters stays for the record and is no longer read.
--   * the unique index on (booking_no, party_no) becomes (night, booking_no, party_no).
--   * rider_register mints from the night's counter.
--   * rider_party_add and rider_edit find a party by its night as well as its number; rider_edit
--     picks, among bookings sharing a number, the one this phone made that is still to ride on a
--     night that is still open, and a move to another night takes that night's next number.
-- The functions are rebuilt from their LIVE definitions with only these lines changed, so their
-- SECURITY DEFINER, search_path and grants stay as they are. Each change must match exactly once
-- or the migration stops; running it again changes nothing.

create table if not exists public.rider_night_counters (
  session_key text not null,           -- the night's session id, '' for a registration with none
  source      text not null,
  n           integer not null default 0,
  primary key (session_key, source)
);
alter table public.rider_night_counters enable row level security;
revoke all on public.rider_night_counters from public, anon, authenticated;

insert into public.rider_night_counters (session_key, source, n)
select coalesce(session_id, ''), source, max(nullif(regexp_replace(booking_no, '\D', '', 'g'), '')::int)
  from public.rider_registrations
 where booking_no is not null and source is not null
 group by 1, 2
on conflict (session_key, source) do update set n = greatest(rider_night_counters.n, excluded.n);

drop index if exists public.rider_registrations_booking_no;
create unique index if not exists rider_registrations_booking_no
  on public.rider_registrations (coalesce(session_id, ''), booking_no, party_no);

create or replace function pg_temp._once(src text, old text, new text) returns text language plpgsql as $f$
begin
  if position(new in src) > 0 and position(old in src) = 0 then return src; end if;  -- already done
  if (length(src) - length(replace(src, old, ''))) / length(old) <> 1 then
    raise exception 'expected exactly one match of: %', left(old, 90);
  end if;
  return replace(src, old, new);
end $f$;

do $mig$
declare d text;
begin
  -- rider_register: the night's own counter
  d := pg_get_functiondef('public.rider_register(text,text,integer,text,text,text,text,text,jsonb)'::regprocedure);
  d := pg_temp._once(d,
$o$    insert into rider_booking_counters(source, n) values (v_src, 1)
      on conflict (source) do update set n = rider_booking_counters.n + 1 returning n into v_seq;$o$,
$n$    -- Numbers start again at P-001 every night: each night has its own counter.
    insert into rider_night_counters(session_key, source, n) values (coalesce(v_sess.id, ''), v_src, 1)
      on conflict (session_key, source) do update set n = rider_night_counters.n + 1 returning n into v_seq;$n$);
  execute d;

  -- rider_party_add: a party is its number on its night
  d := pg_get_functiondef('public.rider_party_add(bigint,jsonb)'::regprocedure);
  d := pg_temp._once(d,
$o$  select * into v_row from rider_registrations where booking_no = v_row.booking_no and party_no = 1;$o$,
$n$  select * into v_row from rider_registrations where booking_no = v_row.booking_no and coalesce(session_id, '') = coalesce(v_row.session_id, '') and party_no = 1;$n$);
  d := pg_temp._once(d,
$o$  perform pg_advisory_xact_lock(hashtext('rider-party:' || v_row.booking_no));$o$,
$n$  perform pg_advisory_xact_lock(hashtext('rider-party:' || coalesce(v_row.session_id, '') || ':' || v_row.booking_no));$n$);
  d := pg_temp._once(d,
$o$  select count(*), coalesce(max(party_no), 1) into v_n, v_next from rider_registrations where booking_no = v_row.booking_no;$o$,
$n$  select count(*), coalesce(max(party_no), 1) into v_n, v_next from rider_registrations where booking_no = v_row.booking_no and coalesce(session_id, '') = coalesce(v_row.session_id, '');$n$);
  execute d;

  -- rider_edit: which booking a number means, and a move to another night
  d := pg_get_functiondef('public.rider_edit(text,text,text,text,integer,text,text,text,text,jsonb)'::regprocedure);
  d := pg_temp._once(d,
$o$  v_r jsonb;
begin$o$,
$n$  v_r jsonb;
  v_seq integer; v_bno text;
begin$n$);
  d := pg_temp._once(d,
$o$  select * into v_row from rider_registrations where upper(booking_no) = upper(trim(coalesce(p_booking_no,''))) and party_no = 1;$o$,
$n$  -- The same number can be a booking on several nights: the one this phone made, not yet
  -- checked in, on a night still open, the latest first.
  select r.* into v_row from rider_registrations r left join sessions s on s.id = r.session_id
   where upper(r.booking_no) = upper(trim(coalesce(p_booking_no,''))) and r.party_no = 1
   order by (r.phone is not null and right(regexp_replace(r.phone, '\D', '', 'g'), 9) = v_proof) desc,
            (r.checked_in_at is null) desc,
            (coalesce(s.status, '') in ('open', 'full')) desc,
            r.session_id desc nulls last
   limit 1;$n$);
  d := pg_temp._once(d,
$o$and r.booking_no is distinct from v_row.booking_no) then$o$,
$n$and (r.booking_no is distinct from v_row.booking_no or coalesce(r.session_id, '') is distinct from coalesce(v_row.session_id, ''))) then$n$);
  d := pg_temp._once(d,
$o$    perform set_config('mm.rider_proved', v_row.booking_no, true);
    update rider_registrations
       set badge = trim(p_badge), session_id = v_sess_id
     where booking_no = v_row.booking_no;   -- the whole party moves together$o$,
$n$    -- A move to another night takes that night's next number: every night counts from P-001.
    v_bno := v_row.booking_no;
    if coalesce(v_sess_id, '') <> coalesce(v_row.session_id, '') then
      insert into rider_night_counters(session_key, source, n) values (coalesce(v_sess_id, ''), coalesce(v_row.source, 'petromin'), 1)
        on conflict (session_key, source) do update set n = rider_night_counters.n + 1 returning n into v_seq;
      v_bno := upper(left(coalesce(v_row.source, 'petromin'), 1)) || '-' || lpad(v_seq::text, 3, '0');
    end if;
    perform set_config('mm.rider_proved', v_bno, true);
    update rider_registrations
       set badge = trim(p_badge), session_id = v_sess_id, booking_no = v_bno
     where booking_no = v_row.booking_no and coalesce(session_id, '') = coalesce(v_row.session_id, '');   -- the whole party moves together$n$);
  execute d;
end $mig$;
