-- ─────────────────────────────────────────────────────────────────────────────
-- A complimentary ride costs nothing, whoever writes the row.
--
-- _enforce_booking_price opens with a blanket staff exemption on UPDATE:
--
--   if tg_op = 'UPDATE' and is_staff() then return new; end if;
--
-- so a staff edit skipped every rule below it, the free-ride zeroing included.
-- One booking on the 22 Aug Saturday ride carries SAR 57.50 because of it,
-- unpaid, on a ride that is complimentary by definition.
--
-- The exemption is there for a good reason -- staff adjust prices on the
-- circuit, and the Edit price button depends on it -- so it stays. What moves
-- is the free-ride rule, which now runs BEFORE it: on a community session with
-- paid_ride = false the price is zero, and nothing downstream can set it
-- otherwise. Every other price stays exactly as adjustable as it was.
--
-- This matters more since the roster stopped showing Price and Payment on
-- complimentary rides (2026-09-02): a stray amount there is now invisible on
-- every screen AND uneditable through the UI, so the database is the only
-- place left that can hold the line.
--
-- Rollback: re-apply with the free-ride block moved back below the exemption.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._enforce_booking_price()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
declare canonical numeric; _kind text; _paid boolean;
begin
  select coalesce(s.event_kind,''), coalesce(s.paid_ride,false)
    into _kind, _paid
    from sessions s where s.id = new.session_id;

  -- Complimentary is a property of the SESSION, not of who is editing the row.
  -- Checked before the staff exemption, so it holds on every path.
  if _kind = 'community' and not _paid then
    new.price := 0;
    return new;
  end if;

  -- Staff adjust prices on a priced ride; that is what the Edit price button does.
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

-- The one row the old hole let through.
update queue_entries q set price = 0
  from sessions s
 where s.id = q.session_id
   and s.event_kind = 'community' and coalesce(s.paid_ride,false) = false
   and coalesce(q.price,0) <> 0;
