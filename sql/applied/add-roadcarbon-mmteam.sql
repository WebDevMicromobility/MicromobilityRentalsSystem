-- ============================================================================
-- Road Carbon tier + MMTEAM discount code. Run once in the Supabase SQL editor.
-- Idempotent.
--
-- 1. Server sticker price for the new 'Road Carbon' booking type (SAR 250), so the
--    booking-price-integrity trigger enforces it instead of falling back to the
--    loose "unknown type" branch.
-- 2. promo_codes.applies_to — optional bike-type restriction for a code. The app
--    applies such a code per matching bike only (other riders keep full price).
-- 3. The MMTEAM code itself: flat SAR 75 off each Road Carbon bike (250 -> 175).
-- ============================================================================

-- 1) server-authoritative sticker price
insert into ride_prices(type, price) values ('Road Carbon', 250)
on conflict (type) do update set price = excluded.price;

-- 2) optional type restriction on promo codes
alter table promo_codes add column if not exists applies_to text;

-- 3) the MMTEAM code: SAR 75 off, Road Carbon only  (250 - 75 = 175)
insert into promo_codes (id, code, kind, value, active, applies_to, created_at)
values ('promo-mmteam-roadcarbon', 'MMTEAM', 'flat', 75, true, 'Road Carbon',
        to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
on conflict (id) do update
  set code = excluded.code, kind = excluded.kind, value = excluded.value,
      active = true, applies_to = excluded.applies_to;

-- Verify:
--   select * from ride_prices where type = 'Road Carbon';
--   select code, kind, value, applies_to, active from promo_codes where code = 'MMTEAM';
