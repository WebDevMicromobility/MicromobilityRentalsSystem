-- Hybrid, Mountain and Kids move from 50 to 57.5. Petromin employees keep 50.
--
-- Run this in the Supabase SQL editor on production, as one script. It is wrapped in a
-- transaction: if any statement fails, nothing changes.
--
-- WHY THE DATABASE AND NOT THE APP: _enforce_booking_price overwrites whatever price a client
-- sends, for any unpaid booking that has no bike yet. The client constants are a quote; this
-- is the charge. The external Petromin form at micromobility.sa/petromin never sends a price
-- at all, so this trigger is the only place its fare can be held.

begin;

-- ── 1. The standard fare ─────────────────────────────────────────────────────
-- 'Any' moves with the three named types on purpose. It is the FLOOR of the range a rider is
-- quoted when they express no preference, and the cheapest bike they can now be given is
-- 57.5 — leaving it at 50 would quote a fare that no bike charges. Six of the open bookings
-- repriced below are booked as Any.
update public.ride_prices set price = 57.5
 where type in ('Hybrid', 'Mountain', 'Kids', 'Any');

-- ── 2. Where a ride kind charges its own fare ────────────────────────────────
-- A table rather than a constant inside the trigger, so the next exception (a corporate day,
-- a sponsor) is a row someone can add, not another edit to a function that prices every
-- booking in the system. A kind with no row here simply falls through to ride_prices.
create table if not exists public.ride_prices_by_kind (
  ride_kind text    not null,
  type      text    not null,
  price     numeric not null check (price >= 0 and price <= 1000),
  primary key (ride_kind, type)
);

alter table public.ride_prices_by_kind enable row level security;
drop policy if exists "public read" on public.ride_prices_by_kind;
create policy "public read" on public.ride_prices_by_kind for select using (true);
-- SELECT only. ride_prices carries wider grants held back by RLS; there is no reason to
-- repeat that here.
grant select on public.ride_prices_by_kind to anon, authenticated;

insert into public.ride_prices_by_kind (ride_kind, type, price) values
  ('petromin', 'Hybrid',   50),
  ('petromin', 'Mountain', 50),
  ('petromin', 'Kids',     50),
  ('petromin', 'Any',      50)
on conflict (ride_kind, type) do update set price = excluded.price;

-- ── 3. The trigger learns which ride it is pricing ───────────────────────────
-- Unchanged except for _ride_kind and the lookup that prefers it. SECURITY DEFINER and the
-- search_path are restated deliberately: CREATE OR REPLACE drops them otherwise, and this
-- function reads sessions on behalf of an anonymous caller.
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

    -- The ride kind's own fare wins when there is one; otherwise the standard fare.
    select price into canonical
      from ride_prices_by_kind
     where ride_kind = _ride_kind and type = new.type_preference;

    if canonical is null then
      select price into canonical from ride_prices where type = new.type_preference;
    end if;

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

-- ── 4. Bookings already taken at 50 ──────────────────────────────────────────
-- Only OPEN ones: unpaid, no bike handed over, still waiting. A completed ride that was paid
-- at 50 was paid at 50, and rewriting it would falsify what the till took that evening.
-- Petromin bookings are excluded by the same rule the trigger now follows.
update public.queue_entries q
   set price = 57.5
  from public.sessions s
 where s.id = q.session_id
   and q.price = 50
   and coalesce(s.ride_kind, '') <> 'petromin'
   and coalesce(q.paid, false) = false
   and q.assigned_bike_id is null
   and q.status in ('waiting', 'waitlist');

commit;

-- ── Check what happened ──────────────────────────────────────────────────────
-- Expect: no non-Petromin open booking left at 50, and the Petromin ones untouched.
select coalesce(s.ride_kind, '(circuit)') as ride_kind, q.price, count(*) as bookings
  from queue_entries q
  left join sessions s on s.id = q.session_id
 where q.status in ('waiting', 'waitlist')
 group by 1, 2
 order by 1, 2;

select * from ride_prices order by type;
select * from ride_prices_by_kind order by ride_kind, type;
