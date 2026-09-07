-- ─────────────────────────────────────────────────────────────────────────────
-- Restore SECURITY DEFINER on two trigger functions I silently stripped it from.
--
-- CREATE OR REPLACE FUNCTION replaces the WHOLE definition, attributes included.
-- Twice this month I reproduced a function from its pg_proc.prosrc -- which is
-- the BODY only, never the header -- and rewrote it without `security definer`,
-- quietly demoting it to invoker rights:
--
--   _enforce_booking_price  lost it in 20260904120000 (complimentary_means_zero)
--   _group_ride_cap         lost it in 20260903120000 (petromin_one_extra_rider)
--
-- The first one broke the booth. _promo_valid is deliberately revoked from anon
-- and authenticated (20260816120000) because it is only ever meant to be called
-- from inside this definer trigger. With the trigger running as the caller, a
-- staff INSERT that reaches the promo branch dies with
--
--     permission denied for function _promo_valid
--
-- Staff could not add a rider to any PRICED session (the circuit, Petromin).
-- Customer bookings kept working the whole time and hid the breakage: they go
-- through customer_create_booking, which IS security definer, so the trigger
-- inherited definer rights there. Complimentary rides also kept working -- they
-- return before the promo branch. Exactly the blind spot that let it ship.
--
-- _group_ride_cap had not broken yet: it counts queue_entries rows, and every
-- path that reaches it today is either staff (early return) or already inside a
-- definer RPC. It was one refactor away from silently counting zero rows under
-- RLS and never enforcing the two-rider cap at all.
--
-- Bodies below are prod's current ones, byte for byte. The ONLY change is the
-- restored `security definer` line.
--
-- Rollback: re-apply without `security definer` (and re-break the booth).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._enforce_booking_price()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare canonical numeric; _kind text; _paid boolean;
begin
  select coalesce(s.event_kind,''), coalesce(s.paid_ride,false)
    into _kind, _paid
    from sessions s where s.id = new.session_id;

  -- Complimentary is a property of the SESSION, not of who is editing the row.
  if _kind = 'community' and not _paid then
    new.price := 0;
    return new;
  end if;

  if tg_op = 'UPDATE' and (select is_staff()) then return new; end if;

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

CREATE OR REPLACE FUNCTION public._group_ride_cap()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _live int;
begin
  if new.customer_id is null or (select is_staff()) then return new; end if;

  if not exists (select 1 from sessions s
                  where s.id = new.session_id
                    and s.event_kind = 'community'
                    and coalesce(s.needs_approval,false) = false) then
    return new;
  end if;

  select count(*) into _live
    from queue_entries q
   where q.session_id = new.session_id
     and q.customer_id = new.customer_id
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and q.id <> new.id;

  if _live >= 2 then
    raise exception 'Up to 2 riders per booking on this ride.';
  end if;

  return new;
end $function$;
