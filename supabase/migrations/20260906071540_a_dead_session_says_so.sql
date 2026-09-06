-- ─────────────────────────────────────────────────────────────────────────────
-- A dead session says so.
--
-- Reported 2026-09-06: a rider on the confirm step taps "Confirm booking" and
-- gets a black toast reading "booking refused". Six attempts, nothing lands, no
-- error anywhere. Traced end to end:
--
--   1. customer_create_booking opens with `if not _cust_token_ok(...) then
--      return; end if` -- it returns ZERO ROWS. PostgREST answers 200 with an
--      empty array, the client cannot tell that from "no rows inserted", and
--      _createBookings invents the string 'booking refused' for it.
--   2. The app HAS a guard for exactly this: _custSessionCheck() calls
--      customer_token_ok() at boot and signs the rider out cleanly when the
--      stored token has gone stale. That function's grant was revoked two days
--      after it was written, by 20260816140000_revoke_from_public.sql, which
--      swept the customer-facing customer_token_ok in with the internal
--      _cust_token_ok. Every call has returned 401/403 since -- 105 of them in
--      the 24h before this migration. The check fails open by design (a
--      transport blip must never log a working rider out), so nothing noticed.
--
-- Net effect: a device whose token died -- pre-20260814150000 logins rotated the
-- token on every sign-in, so any rider who signed in on a second device before
-- that fix has one -- stays "signed in" forever, sees an empty My Rides, and has
-- every booking silently discarded with no way to find out why. The rider in the
-- report last booked successfully on 2026-08-13, the day before token rotation
-- was fixed.
--
-- Three changes, no schema:
--
--   A. Re-grant customer_token_ok to anon. It answers one boolean about a token
--      the caller already holds; guessing a 24-byte token is infeasible, which
--      is the argument 20260814150000 made when it created the function and
--      granted it. _cust_token_ok (the internal helper, called only from inside
--      SECURITY DEFINER bodies) stays revoked -- that one was right.
--
--   B. customer_create_booking RAISES instead of returning empty when it turns
--      a booking away for a reason the rider can act on: STALE_SESSION (sign in
--      again) and SESSION_CLOSED (that session is no longer open). Both map to
--      messages the app already has. A malformed batch still returns empty --
--      that is a client bug, not something to word for a rider.
--
--   C. customer_exists and staff_email_for_phone are declared STABLE but call
--      _oracle_gate(), which INSERTs a throttle row. PostgREST runs a STABLE
--      function in a READ ONLY transaction, so both have been dying with
--      "cannot execute INSERT in a read-only transaction" -> HTTP 405 since
--      20260904140000 added the gate: 33 and 5 failures respectively in the same
--      24h window. Signup falls through to a 409 DUPLICATE instead of saying
--      "you already have an account", and staff phone sign-in cannot resolve an
--      email. They are VOLATILE -- they write.
--
-- Rollback:
--   revoke execute on function public.customer_token_ok(text,text) from anon, authenticated;
--   (and re-apply customer_create_booking / customer_exists / staff_email_for_phone
--    from git history -- the previous bodies are in
--    20260826150000_waiver_acceptance_on_every_rider.sql and
--    20260904140000_roles_get_teeth_and_oracles_get_throttled.sql)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A. The stale-session check can run again ────────────────────────────────
grant execute on function public.customer_token_ok(text,text) to anon, authenticated;

comment on function public.customer_token_ok(text,text) is
  'Boolean: does this customer id still hold this session token? Called by the app at boot (_custSessionCheck) to sign out a device whose token was rotated away. Granted to anon deliberately -- see 20260906120000. Not to be confused with _cust_token_ok, the internal helper, which stays revoked.';

-- ── B. A refusal the rider can act on says which one it is ──────────────────
-- Unchanged from 20260826150000 apart from the two guards that now raise: the
-- batch bounds, the "on the house" rule, the field truncation, the waiver stamp
-- and the waiting/waitlist decision are all exactly as they were.
CREATE OR REPLACE FUNCTION public.customer_create_booking(p_id text, p_token text, p_entries jsonb)
 RETURNS TABLE(id text, queue_num integer, status text, waitlist_num integer, price numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
declare
  it jsonb; cust customers%rowtype; _first boolean := true;
  _appr boolean; _house text; _paid boolean; _price numeric;
  _sid text; _sstatus text; _status text; _wv text;
begin
  -- The device is holding a token this account no longer has (rotated by a
  -- password change, or minted before logins stopped rotating). Say so: the app
  -- signs the rider out and asks them to sign in again. Returning empty here is
  -- what produced "booking refused" with nothing else on any screen.
  if not _cust_token_ok(p_id, p_token) then
    raise exception 'STALE_SESSION' using errcode = 'P0001';
  end if;
  select * into cust from customers where customers.id = p_id;
  if not found then
    raise exception 'STALE_SESSION' using errcode = 'P0001';
  end if;

  -- A malformed batch is a client bug, not a rider-facing state: still empty.
  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) = 0 or jsonb_array_length(p_entries) > 10 then
    return;
  end if;

  _sid := p_entries->0->>'session_id';
  select coalesce(s.needs_approval,false), coalesce(s.status,'') into _appr, _sstatus from sessions s
   where s.id = _sid and coalesce(s.status,'') in ('open','full');
  -- Closed, deleted, or gone while the rider sat on the confirm step.
  if not found then
    raise exception 'SESSION_CLOSED' using errcode = 'P0001';
  end if;

  _status := case when _sstatus = 'full' then 'waitlist' else 'waiting' end;

  if coalesce(cust.default_pay,'') like 'house%' then
    _house := case when cust.default_pay = 'house' then 'all'
                   else substring(cust.default_pay from 7) end;
  end if;

  for it in select * from jsonb_array_elements(p_entries) loop
    if it->>'session_id' is distinct from _sid then return; end if;

    _paid := false;
    _price := nullif(it->>'price','')::numeric;
    if _first and _house is not null
       and lower(btrim(coalesce(it->>'name',''))) = lower(btrim(coalesce(cust.name,'')))
       and (_house = 'all' or coalesce(it->>'type_preference','Any') = any(string_to_array(_house, ',')))
    then
      _paid := true;
      _price := 0;
    end if;
    _first := false;

    -- The version is the client's (only it knows which text it rendered); the TIME is ours.
    -- A timestamp the caller can choose is not evidence of anything.
    _wv := left(nullif(it->>'waiver_version',''), 40);

    return query
    insert into queue_entries (
      id, name, size, height, type_preference, session_id, session_day, session_date,
      queue_num, registered_at, phone, email, status, paid, price, promo_code,
      customer_id, walk_in, group_id, approval, assigned_bike_id,
      waiver_at, waiver_version
    ) values (
      coalesce(nullif(it->>'id',''), encode(gen_random_bytes(12),'hex')),
      left(coalesce(it->>'name',''), 60),
      coalesce(it->>'size',''),
      nullif(it->>'height','')::int,
      coalesce(it->>'type_preference','Any'),
      _sid,
      it->>'session_day',
      it->>'session_date',
      coalesce(nullif(it->>'queue_num','')::int, 0),
      coalesce(nullif(it->>'registered_at',''), now()::text),
      left(coalesce(it->>'phone', coalesce(cust.phone,'')), 30),
      left(coalesce(it->>'email', coalesce(cust.email,'')), 120),
      _status,
      _paid,
      _price,
      nullif(it->>'promo_code',''),
      p_id,
      false,
      nullif(it->>'group_id',''),
      case when _appr then 'pending' else null end,
      null,
      case when _wv is not null
           then to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"') else null end,
      _wv
    )
    returning queue_entries.id, queue_entries.queue_num, queue_entries.status,
              queue_entries.waitlist_num, queue_entries.price;
  end loop;
end $function$;

-- ── C. A function that writes is VOLATILE ───────────────────────────────────
-- Bodies unchanged from 20260904140000; only the volatility marker moves, so the
-- throttle INSERT inside _oracle_gate() is no longer attempted in a read-only
-- transaction. CREATE OR REPLACE keeps the existing grants.
CREATE OR REPLACE FUNCTION public.customer_exists(p_email text, p_phone text)
 RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  -- Over budget answers "no account", not an error: the reply's SHAPE must not
  -- become the new oracle. A throttled real user falls through to signup, whose
  -- unique constraints still hold the line.
  if not _oracle_gate() then return false; end if;
  return exists(select 1 from customers
    where (coalesce(p_email,'')<>'' and lower(email)=lower(p_email))
       or (coalesce(p_phone,'')<>'' and phone=p_phone));
end $function$;

CREATE OR REPLACE FUNCTION public.staff_email_for_phone(p_phone text)
 RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  -- Same rule: over budget looks like "no such phone"; staff fall back to
  -- typing their email, which never touches this function.
  if not _oracle_gate() then return null; end if;
  return (select email from staff_phones
    where regexp_replace(phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    limit 1);
end $function$;
