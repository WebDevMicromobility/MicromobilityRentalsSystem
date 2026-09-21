-- ============================================================================
-- The Petromin fare (50) is the EMPLOYEES' fare, not the night's.
--
-- APPLIED AND VERIFIED 2026-09-21 (pasted into the SQL editor, history row recorded).
-- 2026-09-21-pw #15, #20, #21, #25 read 57.5; ride_prices_by_kind is empty; the trigger
-- is on rider_registrations; supabase/checks/security-attributes.sql returns no rows.
--
-- sql/ride-prices-57-5.sql gave the whole Petromin ride its own fare through
-- ride_prices_by_kind, so every booking on a Petromin night came out at 50 - including
-- riders who booked it on the website like any other ride. The 50 is meant only for
-- employees who come through the company's registration form (the Riders list).
--
-- Who is an employee: a booking that a rider_registrations row points at
-- (matched_entry_id), where the registration's form is the ride's own (source = ride_kind).
-- rider_register makes that link when an employee's form matches a booking they already
-- hold; the desk makes it when it books a registered rider or a walk-in from the Riders
-- tab. Everyone else on the same night pays the standard fare from ride_prices.
--
-- A registered employee with no queue booking at all is billed from the registration
-- itself (_rider_price, applied at return by _rider_registration_guard). That is
-- unchanged, and so is the billing report.
--
-- What changes:
--   1. _employee_fare / _booking_fare hold the rule in one place.
--   2. _enforce_booking_price prices from _booking_fare instead of ride_prices_by_kind.
--   3. Linking or unlinking a registration reprices the booking it points at, since the
--      desk links AFTER the booking is written (the insert is priced as a stranger's).
--   4. ride_prices_by_kind loses its Petromin rows. The table stays (additive-only house
--      rule) but nothing reads it any more.
--   5. Open Petromin bookings are brought to the fare they should carry.
--
-- Rollback: re-run sections 2-3 of sql/ride-prices-57-5.sql, drop trigger
-- rider_registration_link_reprice. Idempotent.
-- ============================================================================

begin;

-- ── 1. The rule ──────────────────────────────────────────────────────────────
-- The employee fare for a bike type, or null where an employee pays like anyone else
-- (Own is free for everyone; Road Carbon is not a Petromin product).
create or replace function public._employee_fare(p_type text)
 returns numeric
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case when p_type in ('Hybrid','Mountain','Kids','Any','Road') then _rider_price(p_type) end
$function$;

-- The fare an open booking should carry: the employee fare when a registration from its
-- ride's own form points at it, otherwise the standard fare (null for a type with no row,
-- e.g. Own, which the caller handles as before).
create or replace function public._booking_fare(p_entry_id text, p_ride_kind text, p_type text)
 returns numeric
 language sql
 stable
 set search_path to 'public'
as $function$
  select coalesce(
    case when exists (select 1 from rider_registrations r
                       where r.matched_entry_id = p_entry_id
                         and r.source = p_ride_kind)
         then _employee_fare(p_type) end,
    (select price from ride_prices where type = p_type))
$function$;

-- Internal: called only from SECURITY DEFINER triggers. It reads rider_registrations,
-- which anon and customers cannot.
revoke execute on function public._booking_fare(text, text, text) from public, anon, authenticated;

-- ── 2. The booking trigger ───────────────────────────────────────────────────
-- As in sql/ride-prices-57-5.sql except for the one lookup. SECURITY DEFINER and the
-- search_path are restated deliberately: CREATE OR REPLACE drops them otherwise.
create or replace function public._enforce_booking_price()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare canonical numeric; _kind text; _paid boolean; _ride_kind text;
begin
  select coalesce(s.event_kind, ''), coalesce(s.paid_ride, false), coalesce(s.ride_kind, '')
    into _kind, _paid, _ride_kind
    from sessions s where s.id = new.session_id;

  if _kind = 'community' and not _paid then
    new.price := 0;
    return new;
  end if;

  if tg_op = 'UPDATE' and (select is_staff()) then return new; end if;

  if new.assigned_bike_id is null
     and coalesce(new.paid, false) = false
     and coalesce(new.status, 'waiting') in ('waiting', 'waitlist') then

    -- An employee from the ride's own registration form rides at the employee fare;
    -- everyone else, website bookings included, at the standard fare.
    canonical := _booking_fare(new.id, _ride_kind, new.type_preference);

    if canonical is null and coalesce(new.type_preference, '') <> 'Own' then
      select max(price) into canonical from ride_prices;
    end if;

    if canonical is not null then
      if new.promo_code is not null and new.promo_code <> ''
         and _promo_valid(new.promo_code, new.customer_id) then
        new.price := least(greatest(coalesce(new.price, canonical), 0), canonical);
      else
        if new.promo_code is not null and new.promo_code <> '' then new.promo_code := null; end if;
        new.price := canonical;
      end if;
    else
      new.price := least(greatest(coalesce(new.price, 0), 0), 1000);
    end if;
  end if;

  new.price := least(greatest(coalesce(new.price, 0), 0), 1000);
  return new;
end $function$;

-- ── 3. A link made or broken reprices the booking ────────────────────────────
-- Only a booking that is still open (unpaid, no bike, waiting) and still on one of the two
-- fares moves: a price someone set by hand, or a promo, stands.
create or replace function public._rider_link_reprice()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_old text; v_new text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := old.matched_entry_id; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := new.matched_entry_id; end if;
  if v_old is null and v_new is null then return null; end if;

  update queue_entries q
     set price = f.fare
    from (select q2.id,
                 _booking_fare(q2.id, coalesce(s.ride_kind, ''), q2.type_preference) as fare,
                 (select price from ride_prices where type = q2.type_preference) as std,
                 _employee_fare(q2.type_preference) as emp
            from queue_entries q2
            left join sessions s on s.id = q2.session_id
           where q2.id in (v_old, v_new)) f
   where q.id = f.id
     and f.fare is not null
     and q.price is distinct from f.fare
     and (q.price = f.std or q.price = f.emp)
     and coalesce(q.paid, false) = false
     and q.assigned_bike_id is null
     and q.status in ('waiting', 'waitlist')
     and coalesce(q.promo_code, '') = '';
  return null;
end $function$;

drop trigger if exists rider_registration_link_reprice on public.rider_registrations;
create trigger rider_registration_link_reprice
  after insert or delete or update of matched_entry_id, source on public.rider_registrations
  for each row execute function public._rider_link_reprice();

-- ── 4. The night no longer has its own fare ──────────────────────────────────
delete from public.ride_prices_by_kind where ride_kind = 'petromin';

-- ── 5. Open Petromin bookings take the fare they should carry ────────────────
-- Same limits as the link trigger: paid fares, bikes handed over, promos and hand-set
-- prices are left alone. On 2026-09-21 this moved four website bookings on 2026-09-21-pw
-- (#15 Hybrid, #20, #21, #25 Any) from 50 to 57.5; no employee booking needed to move.
update public.queue_entries q
   set price = f.fare
  from (select q2.id,
               _booking_fare(q2.id, s.ride_kind, q2.type_preference) as fare,
               (select price from ride_prices where type = q2.type_preference) as std,
               _employee_fare(q2.type_preference) as emp
          from queue_entries q2
          join sessions s on s.id = q2.session_id
         where s.ride_kind = 'petromin') f
 where q.id = f.id
   and f.fare is not null
   and q.price is distinct from f.fare
   and (q.price = f.std or q.price = f.emp)
   and coalesce(q.paid, false) = false
   and q.assigned_bike_id is null
   and q.status in ('waiting', 'waitlist')
   and coalesce(q.promo_code, '') = '';

commit;

-- ── Check ────────────────────────────────────────────────────────────────────
-- Expect no rows: every open Petromin booking carries the fare its link says.
-- select s.id, q.queue_num, q.type_preference, q.price,
--        _booking_fare(q.id, s.ride_kind, q.type_preference) as should_be
--   from queue_entries q join sessions s on s.id = q.session_id
--  where s.ride_kind = 'petromin' and q.status in ('waiting','waitlist')
--    and not coalesce(q.paid, false) and q.assigned_bike_id is null
--    and coalesce(q.promo_code, '') = ''
--    and q.price is distinct from _booking_fare(q.id, s.ride_kind, q.type_preference);
-- Then run supabase/checks/security-attributes.sql.
