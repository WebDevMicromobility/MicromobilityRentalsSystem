-- ─────────────────────────────────────────────────────────────────────────────
-- A second kind of community ride: the members gate, nothing else.
--
-- Until now "community" meant exactly one event: the Saturday Social Ride, which
-- is invite-only, complimentary, staff-approved, one seat per member, with the
-- queue hidden until staff publish it. The club now also runs the Petromin
-- Wednesday Ride, which is an ORDINARY session in every respect — real queue
-- numbers, JCC prices, a seat count that overflows to the waitlist, groups —
-- and is private only in who may book it: riders holding the community tag.
--
-- So the gate stays keyed on event_kind='community' (the members-gate trigger,
-- list_sessions() and the approval guard need no changes at all), and the two
-- behaviours that were bundled into that word are split out onto the session:
--
--   ride_kind  'saturday' | 'petromin' — which ride this is (name, colour, group
--              bookings). Display only: no policy reads it, by design.
--   paid_ride  true = price the bookings the way a JCC session is priced.
--
-- and the third one already had a column of its own: needs_approval, which is
-- what "staff pick the riders, so capacity does not apply" actually means. The
-- triggers below now read THAT instead of the event kind, so a community ride
-- with seats behaves like a circuit session all the way down to the database.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The tag is not the Saturday ride any more ────────────────────────────
-- It now admits riders to every community ride, so it is named for what it is.
-- The SLUG stays 'saturday': community_member(), _community_booking_gate() and
-- the temporary-tag window all match on slug, and renaming it would silently
-- lock every member out of every ride.
update tags set name = 'Community' where id = 'tag_saturday';

-- ── 2. The two new session columns ──────────────────────────────────────────
alter table sessions add column if not exists ride_kind text;
alter table sessions add column if not exists paid_ride boolean not null default false;

-- Every community session that exists today is a Saturday ride, and free.
update sessions
   set ride_kind = 'saturday'
 where coalesce(event_kind,'') = 'community'
   and ride_kind is null;

-- ── 3. Complimentary is a property of the session, not of "community" ───────
-- Unchanged from the live definition except the pinning condition: a community
-- ride is free unless it is flagged paid, in which case it falls through to the
-- ordinary canonical-price path — the same one JCC bookings take, promo
-- handling and clamp included. 'Own' has no row in ride_prices, so an own-bike
-- rider still lands on the client's 0.
create or replace function public._enforce_booking_price()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare canonical numeric; _kind text; _paid boolean;
begin
  -- staff set prices deliberately (edit-price modal, check-in repricing)
  if tg_op = 'UPDATE' and (select is_staff()) then return new; end if;

  select coalesce(s.event_kind,''), coalesce(s.paid_ride,false)
    into _kind, _paid
    from sessions s where s.id = new.session_id;

  if _kind = 'community' and not _paid then
    new.price := 0;
    return new;
  end if;

  -- Only a fresh, customer-style booking: no bike yet, not already paid, entering the queue.
  if new.assigned_bike_id is null
     and coalesce(new.paid, false) = false
     and coalesce(new.status, 'waiting') in ('waiting', 'waitlist') then
    select price into canonical from ride_prices where type = new.type_preference;
    if canonical is not null then
      if new.promo_code is not null and new.promo_code <> ''
         and _promo_valid(new.promo_code, new.customer_id) then
        new.price := least(greatest(coalesce(new.price, canonical), 0), canonical);
      else
        new.price := canonical;
      end if;
    else
      new.price := least(greatest(coalesce(new.price, 0), 0), 1000);
    end if;
  end if;

  new.price := least(greatest(coalesce(new.price, 0), 0), 1000);
  return new;
end $function$;

-- ── 4. Road Carbon stays off the FREE ride only ─────────────────────────────
-- The coercion exists because carbon bikes are not offered on the Saturday
-- social ride (booking #58, 2026-08-12). A paid ride rents the whole fleet at
-- list price, so coercing there would charge a rider SAR 250 and hand them a
-- Road bike — the coercion is now scoped to rides that do not charge.
create or replace function public._comm_no_carbon()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.type_preference = 'Road Carbon' and exists(
    select 1 from sessions s
     where s.id = new.session_id
       and s.event_kind = 'community'
       and coalesce(s.paid_ride,false) = false) then
    new.type_preference := 'Road';
  end if;
  return new;
end$function$;

-- ── 5. Seats overflow to the waitlist, on every session that has seats ──────
-- The guard used to exempt "community" wholesale, because the Saturday ride
-- allocates its places by staff approval and its capacity number means nothing.
-- That is what needs_approval says, and it is the honest test: a community ride
-- WITHOUT approval sells seats, so the 12th rider into a 10-seat Petromin ride
-- has to land on the waitlist exactly as they would at the circuit.
create or replace function public._capacity_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare cap int; live int;
begin
  if new.status='waiting' and not is_staff() then
    select coalesce(s.capacity,12) into cap from sessions s
      where s.id=new.session_id and coalesce(s.needs_approval,false)=false;
    if cap is not null then
      perform pg_advisory_xact_lock(hashtext('cap:'||new.session_id));
      select count(*) into live from queue_entries q
        where q.session_id=new.session_id and q.status in ('waiting','active');
      if live>=cap then new.status:='waitlist'; end if;
    end if;
  end if;
  return new;
end$function$;

-- ── 6. Only an approval ride creates reservations ───────────────────────────
-- Unchanged from the live definition except the approval expression: a booking
-- is 'pending' when the SESSION asks for approval, not when it happens to be a
-- community one. A Petromin booking is a plain confirmed booking (approval
-- null), which is what every "is this rider in?" check in the app reads.
create or replace function public.customer_create_booking(p_id text, p_token text, p_entries jsonb)
returns table(id text, queue_num integer, status text, waitlist_num integer, price numeric)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  it        jsonb;
  cust      customers%rowtype;
  _first    boolean := true;
  _appr     boolean;
  _house    text;
  _paid     boolean;
  _price    numeric;
  _sid      text;
  _sstatus  text;
  _status   text;
begin
  if not _cust_token_ok(p_id, p_token) then return; end if;
  select * into cust from customers where customers.id = p_id;
  if not found then return; end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) = 0 or jsonb_array_length(p_entries) > 10 then
    return;
  end if;

  _sid := p_entries->0->>'session_id';
  select coalesce(s.needs_approval,false), coalesce(s.status,'') into _appr, _sstatus from sessions s
   where s.id = _sid and coalesce(s.status,'') in ('open','full');
  if not found then return; end if;

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

    return query
    insert into queue_entries (
      id, name, size, height, type_preference, session_id, session_day, session_date,
      queue_num, registered_at, phone, email, status, paid, price, promo_code,
      customer_id, walk_in, group_id, approval, assigned_bike_id
    ) values (
      coalesce(nullif(it->>'id',''), encode(gen_random_bytes(12),'hex')),
      left(coalesce(it->>'name',''), 60),
      coalesce(it->>'size',''),
      nullif(it->>'height','')::int,
      coalesce(it->>'type_preference','Any'),
      _sid,
      it->>'session_day',
      it->>'session_date',
      -- 0 is a placeholder; queue_entries_assign_qnum overwrites it atomically.
      coalesce(nullif(it->>'queue_num','')::int, 0),
      coalesce(nullif(it->>'registered_at',''), now()::text),
      left(coalesce(it->>'phone', coalesce(cust.phone,'')), 30),
      left(coalesce(it->>'email', coalesce(cust.email,'')), 120),
      _status,                        -- server-decided; _capacity_guard may still coerce it
      _paid,                          -- derived, never taken from the request
      _price,                         -- clamped (and re-derived) by _enforce_booking_price
      nullif(it->>'promo_code',''),   -- validity is enforced by _promo_valid in the trigger
      p_id,                           -- the token's owner, not whatever was sent
      false,
      nullif(it->>'group_id',''),
      case when _appr then 'pending' else null end,
      null                            -- customers never assign themselves a bike
    )
    returning queue_entries.id, queue_entries.queue_num, queue_entries.status,
              queue_entries.waitlist_num, queue_entries.price;
  end loop;
end $function$;

grant execute on function public.customer_create_booking(text,text,jsonb) to anon, authenticated;
