-- Promo codes: expiry, usage limits, and per-customer codes. 2026-08-16.
--
-- Codes were global and open-ended: active or not, and nothing else. That rules out every
-- campaign worth running — a first-ride code, a win-back code, a birthday code — because
-- any of them can be shared once and used forever by anyone.
--
-- Enforcement lives in the DB, not the client. The booking form can be bypassed; the price
-- trigger cannot, and it is already the thing that decides whether a discounted price is
-- allowed to stand.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The new columns. All nullable, so every existing code keeps behaving exactly
-- as it does today (no expiry, no cap, open to everyone).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.promo_codes add column if not exists expires_at  date;
alter table public.promo_codes add column if not exists max_uses    integer;
alter table public.promo_codes add column if not exists uses        integer not null default 0;
alter table public.promo_codes add column if not exists customer_id text;

comment on column public.promo_codes.expires_at  is 'Last day the code may be used, inclusive. NULL = never expires.';
comment on column public.promo_codes.max_uses    is 'Total bookings that may carry this code. NULL = unlimited.';
comment on column public.promo_codes.uses        is 'Bookings that have carried this code; maintained by trg_promo_count.';
comment on column public.promo_codes.customer_id is 'Bind the code to one customer. NULL = anyone may use it.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. One place that answers "may this code be used, by this person, right now".
-- SECURITY DEFINER so it can read promo_codes from inside the price trigger
-- regardless of who is inserting.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._promo_valid(p_code text, p_customer text)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $function$
  select exists (
    select 1 from promo_codes c
     where lower(c.code) = lower(p_code)
       and c.active = true
       and (c.expires_at  is null or c.expires_at >= (now() at time zone 'Asia/Riyadh')::date)
       and (c.max_uses    is null or coalesce(c.uses, 0) < c.max_uses)
       and (c.customer_id is null or c.customer_id = p_customer)
  );
$function$;

-- NOTE (2026-08-16): no effect — see 20260816140000_revoke_from_public.sql. A PUBLIC grant
-- survives a revoke aimed at a role.
revoke execute on function public._promo_valid(text, text) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. The price trigger asks the helper instead of only checking `active`. This is
-- the whole enforcement: an expired / used-up / someone-else's code no longer buys
-- a discounted price, so the row is re-derived at the canonical fare.
-- Everything else in this function is unchanged from 20260815120000.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._enforce_booking_price()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare canonical numeric; _kind text;
begin
  -- staff set prices deliberately (edit-price modal, check-in repricing)
  if tg_op = 'UPDATE' and (select is_staff()) then return new; end if;

  select coalesce(s.event_kind,'') into _kind from sessions s where s.id = new.session_id;
  if _kind = 'community' then
    new.price := 0;
    return new;
  end if;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Count uses server-side. Doing this in the client would let a refresh, a retry
-- or a second device inflate or skip the count. Cancelled bookings give the use
-- back, so a rider who cancels is not punished for it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._promo_count()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.promo_code is not null and new.promo_code <> '' then
      update promo_codes set uses = coalesce(uses, 0) + 1
       where lower(code) = lower(new.promo_code);
    end if;
    return new;
  end if;

  -- a booking leaving the live set releases its use
  if coalesce(old.status,'') not in ('cancelled','removed')
     and coalesce(new.status,'') in ('cancelled','removed')
     and new.promo_code is not null and new.promo_code <> '' then
    update promo_codes set uses = greatest(coalesce(uses, 0) - 1, 0)
     where lower(code) = lower(new.promo_code);
  -- ...and coming back from cancelled takes it again
  elsif coalesce(old.status,'') in ('cancelled','removed')
     and coalesce(new.status,'') not in ('cancelled','removed')
     and new.promo_code is not null and new.promo_code <> '' then
    update promo_codes set uses = coalesce(uses, 0) + 1
     where lower(code) = lower(new.promo_code);
  end if;
  return new;
end $function$;

drop trigger if exists trg_promo_count_ins on public.queue_entries;
create trigger trg_promo_count_ins
  after insert on public.queue_entries
  for each row execute function public._promo_count();

drop trigger if exists trg_promo_count_upd on public.queue_entries;
create trigger trg_promo_count_upd
  after update of status on public.queue_entries
  for each row execute function public._promo_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill `uses` from the bookings that already exist, so a cap set today is
-- measured against real history rather than starting from zero.
-- ─────────────────────────────────────────────────────────────────────────────
update public.promo_codes c
   set uses = coalesce((
     select count(*) from queue_entries e
      where lower(e.promo_code) = lower(c.code)
        and coalesce(e.status,'') not in ('cancelled','removed')
   ), 0);
