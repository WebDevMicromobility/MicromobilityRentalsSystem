-- ============================================================================
-- Server-authoritative booking price (closes the "the browser sets its own price" gap).
-- A BEFORE INSERT trigger recomputes a new booking's price on the server, so a crafted
-- API call (or a tampered client) can't book a SAR 75 Road ride for SAR 1. It fires on
-- EVERY insert — direct, offline-sync upsert, or a future RPC — and can't be bypassed.
--
-- What it deliberately does NOT touch (so nothing breaks):
--   • Any UPDATE — staff price edits, check-in repricing from the assigned bike,
--     on-the-house, discounts. Only fresh INSERTs are enforced.
--   • Staff-created bookings that arrive already paid or with a bike assigned.
--   • Promo bookings with a VALID active code — the client's (correctly split) discount
--     is trusted, only bounded to [0, sticker]. A fake/inactive code gets no discount.
--
-- Run once in the Supabase SQL editor. Idempotent. Adjust ride_prices to match your
-- app's RIDE_PRICES if you ever change them.
-- ============================================================================

-- Server source of truth for the per-type sticker price (mirrors the app's RIDE_PRICES).
create table if not exists ride_prices (
  type  text primary key,
  price numeric not null check (price >= 0)
);
insert into ride_prices(type, price) values
  ('Road', 75), ('Mountain', 57.5), ('Hybrid', 57.5), ('Any', 57.5)
on conflict (type) do nothing;

-- Public read (the app may want to show prices); writes stay with staff/service role.
alter table ride_prices enable row level security;
drop policy if exists "public read" on ride_prices;
create policy "public read" on ride_prices for select using (true);

create or replace function _enforce_booking_price()
returns trigger language plpgsql security definer set search_path = public as $$
declare canonical numeric;
begin
  -- Only a fresh, customer-style booking: no bike yet, not already paid, entering the queue.
  -- Staff-created (paid / pre-assigned) rows and every UPDATE pass through untouched.
  if new.assigned_bike_id is null
     and coalesce(new.paid, false) = false
     and coalesce(new.status, 'waiting') in ('waiting', 'waitlist') then

    select price into canonical from ride_prices where type = new.type_preference;

    if canonical is not null then
      if new.promo_code is not null and new.promo_code <> ''
         and exists (select 1 from promo_codes
                     where lower(code) = lower(new.promo_code) and active = true) then
        -- valid active promo: trust the client's (already group-split) discount, bounded
        new.price := least(greatest(coalesce(new.price, canonical), 0), canonical);
      else
        -- no valid promo: the SERVER sets the price; the client value is ignored
        new.price := canonical;
      end if;
    else
      -- unknown/custom type: no server sticker to snap to — just sanity-bound it
      new.price := least(greatest(coalesce(new.price, 0), 0), 1000);
    end if;
  end if;

  -- Hard ceiling on every insert, whatever the branch above decided.
  new.price := least(greatest(coalesce(new.price, 0), 0), 1000);
  return new;
end $$;

drop trigger if exists trg_enforce_booking_price on queue_entries;
create trigger trg_enforce_booking_price
  before insert on queue_entries
  for each row execute function _enforce_booking_price();

-- Belt-and-braces: a plain CHECK so no path (even one that skips the trigger's branch)
-- can ever store a negative or absurd price.
alter table queue_entries drop constraint if exists queue_entries_price_sane;
alter table queue_entries add constraint queue_entries_price_sane
  check (price is null or (price >= 0 and price <= 1000));
