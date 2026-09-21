-- ============================================================================
-- Road Carbon goes out on the Petromin ride (2026-09-21), at the standard 250.
--
-- 20260819160000 took carbon bikes off every community ride and made _comm_no_carbon turn a
-- carbon booking into Road on any community session. The Petromin ride now offers them; the
-- Saturday social ride and the rest of the community family keep the rule.
--
-- Price: nothing to change. _booking_fare (20260921190000) prices a Petromin booking from
-- ride_prices, where Road Carbon is 250, and the employees' fare has no carbon row
-- (_employee_fare returns null for it), so an employee on a carbon bike pays 250 as well.
--
-- Header copied from production (invoker, search_path public), not from prosrc.
-- Rollback: re-run 20260819160000. Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._comm_no_carbon()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.type_preference = 'Road Carbon' and exists(
    select 1 from sessions s
     where s.id = new.session_id
       and s.event_kind = 'community'
       and coalesce(s.ride_kind, '') <> 'petromin') then
    new.type_preference := 'Road';
  end if;
  return new;
end$function$;

-- Verify:
--   select pg_get_functiondef('public._comm_no_carbon()'::regprocedure) like '%petromin%';   -- true
--   select prosecdef from pg_proc where proname = '_comm_no_carbon';                           -- false (as intended)
--   select price from ride_prices where type = 'Road Carbon';                                  -- 250
