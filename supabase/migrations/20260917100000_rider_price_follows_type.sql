-- ============================================================================
-- A returned ride's price follows its bike type.
--
-- _rider_registration_guard() priced a ride once, when checked_out_at was first set, and
-- then left the number alone. Staff correcting the bike type afterwards (the Edit button on
-- the Riders tab) saw the price stay put. The trigger now re-prices a returned row whenever
-- its type_preference changes; everything else is as in 20260916160000.
--
-- APPLIED TO PRODUCTION 2026-09-17 via the Supabase MCP (version 'rider_price_follows_type').
-- If the CLI lists this file as pending: supabase migration repair --status applied 20260917100000
-- Rollback: re-run the _rider_registration_guard definition in 20260916160000_rider_registrations_sessions.sql
-- Idempotent.
-- ============================================================================

create or replace function public._rider_registration_guard()
 returns trigger language plpgsql set search_path to 'public'
as $function$
begin
  -- a return implies a check-in
  if new.checked_out_at is not null and new.checked_in_at is null then new.checked_in_at := new.checked_out_at; end if;
  -- price is fixed the moment the bike is returned, follows a corrected bike type, and is
  -- cleared if the return is undone
  if new.checked_out_at is not null and (old.checked_out_at is null or new.price is null or new.type_preference is distinct from old.type_preference) then
    new.price := _rider_price(new.type_preference);
  end if;
  if new.checked_out_at is null then new.price := null; end if;
  new.updated_at := now();
  return new;
end $function$;
