-- ─────────────────────────────────────────────────────────────────────────────
-- Road Carbon comes back to ONE community ride, at a community fare.
--
-- 20260819160000 took carbon bikes off every community ride, because they do not
-- go out on the Saturday social ride. That is still true of the Saturday ride —
-- and only of the Saturday ride. The Petromin Wednesday Ride now offers Road
-- Carbon to community members at SAR 175 instead of the SAR 250 list price, so
-- the two halves of the database's backstop have to move in step:
--
--   1. `_comm_no_carbon` stops coercing on the Petromin ride (it would hand a
--      rider who booked carbon a Road bike, which is the very bug the coercion
--      exists to prevent — booking #58, 2026-08-12 — only in reverse).
--   2. `_enforce_booking_price` prices carbon on that ride at the community fare.
--      Without this the trigger would silently rewrite the 175 the client quoted
--      back up to the 250 in ride_prices, and the rider would arrive at the booth
--      owing a price no screen ever showed them.
--
-- The fare lives in ride_prices, under a ride-scoped key, for the same reason the
-- list prices do: one server-side source of truth that staff can read. It mirrors
-- COMMUNITY_CARBON_PRICE in app.src.html — change the two together, exactly as
-- RIDE_PRICES and ride_prices have always had to match.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The community fare ───────────────────────────────────────────────────
-- Keyed 'type@ride_kind'. It is NOT a bookable type: nothing writes this string
-- to queue_entries.type_preference, and the lookup below is the only reader.
insert into ride_prices(type, price) values ('Road Carbon@petromin', 175)
on conflict (type) do nothing;

-- ── 2. Carbon is off the Saturday ride, not off "community" ─────────────────
-- Silent coercion, exactly as before, and for the same reason: an old client that
-- still offers the option gets a Road bike rather than an error it cannot explain.
-- The Petromin ride is now excluded, so a carbon booking on it survives as booked.
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
       and coalesce(s.ride_kind,'saturday') <> 'petromin') then
    new.type_preference := 'Road';
  end if;
  return new;
end$function$;

-- ── 3. The canonical price can depend on the ride ───────────────────────────
-- Unchanged from the live definition except the canonical lookup: a ride-scoped
-- fare wins over the list price when one exists for this session's ride kind.
-- Everything else — the staff exemption, the free-ride short circuit, the promo
-- clamp, the final [0,1000] bound — is byte-for-byte what 20260819120000 shipped.
create or replace function public._enforce_booking_price()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare canonical numeric; _kind text; _paid boolean; _ride text;
begin
  -- staff set prices deliberately (edit-price modal, check-in repricing)
  if tg_op = 'UPDATE' and (select is_staff()) then return new; end if;

  select coalesce(s.event_kind,''), coalesce(s.paid_ride,false), coalesce(s.ride_kind,'')
    into _kind, _paid, _ride
    from sessions s where s.id = new.session_id;

  if _kind = 'community' and not _paid then
    new.price := 0;
    return new;
  end if;

  -- Only a fresh, customer-style booking: no bike yet, not already paid, entering the queue.
  if new.assigned_bike_id is null
     and coalesce(new.paid, false) = false
     and coalesce(new.status, 'waiting') in ('waiting', 'waitlist') then
    -- The ride's own fare for this type, falling back to the list price.
    select price into canonical from ride_prices
     where type = new.type_preference || '@' || _ride;
    if canonical is null then
      select price into canonical from ride_prices where type = new.type_preference;
    end if;
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
