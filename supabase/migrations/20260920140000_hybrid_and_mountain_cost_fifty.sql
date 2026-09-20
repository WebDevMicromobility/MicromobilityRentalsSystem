-- ============================================================================
-- Hybrid and Mountain drop from SAR 57.50 to SAR 50. Road stays at 75.
--
-- NOT YET APPLIED. Run in the SQL editor, then:
--   supabase migration repair --status applied 20260920140000
--
-- Two places price a ride and both have to agree, or the roster and the billing
-- report quote different numbers for the same bike:
--
--   ride_prices      the circuit's table, re-derived onto every queue_entries row by
--                    _enforce_booking_price. This is the authoritative one; the client's
--                    RIDE_PRICES is only what the wizard quotes before the row is written.
--   _rider_price()   the Petromin registration's own rule, applied at return, which is
--                    what the billing report bills from.
--
-- 'Any' and 'Kids' move with them deliberately. They ARE the cheap tier: leaving 'Any' at
-- 57.50 would quote a rider MORE for "I don't mind" than for choosing Hybrid outright, and
-- there is not one Kids bike in the fleet. 'Any' keeps its 75 ceiling in the client, so a
-- rider who takes any bike and is handed a Road still reprices to 75.
--
-- Bookings already on the books keep the price they were written with. Only new bookings,
-- and a booking whose type a staff member changes, take the new figure.
-- ============================================================================

update ride_prices set price = 50 where type in ('Hybrid','Mountain','Kids','Any');

-- Petromin: every bike an employee can pick is 50. The form only ever offers Hybrid and
-- Mountain, so 50 is what an employee pays; Road is reachable only when a staff member sets
-- it on the booking at the desk, and that is the one case worth 75.
CREATE OR REPLACE FUNCTION public._rider_price(p_type text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ select case when p_type = 'Road' then 75 else 50 end $function$;

-- Check: every type should read 50 except Road (75) and Road Carbon (250).
-- select type, price from ride_prices order by price, type;
-- select _rider_price('Hybrid'), _rider_price('Mountain'), _rider_price('Road');
