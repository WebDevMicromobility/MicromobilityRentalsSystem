-- ============================================================================
-- Community-ride integrity: complimentary pricing + staff-owned approval.
--
-- Found in production 2026-08-13 (Saturday 2026-08-15 roster):
--   1. _enforce_booking_price() had no community exemption, so "free" Saturday
--      bookings inserted with price 0 were snapped to the JCC sticker price
--      (55 riders stored at SAR 75, 27 at 57.5). Check-in's payment modal would
--      have asked riders to pay for a complimentary ride.
--   2. queue_entries.approval is enforced nowhere server-side: with the current
--      world-writable RLS ("public access" policy), any client holding the anon
--      key can PATCH approval='approved'. Approval is meant to be staff-only.
--
-- This migration:
--   A. Reworks _enforce_booking_price(): community-session inserts are pinned
--      to price 0 (staff repricing via UPDATE stays possible, as before).
--   B. Adds _approval_guard(): non-staff inserts are coerced to 'pending';
--      non-staff updates cannot move approval at all. Silent coercion, not an
--      error, so stale clients keep working. Staff (is_staff()) unaffected.
--   C. Repairs live rows: unpaid bookings in community sessions go back to 0.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── A. Server-authoritative price, now community-aware ──────────────────────
create or replace function _enforce_booking_price()
returns trigger language plpgsql security definer set search_path = public as $$
declare canonical numeric; _kind text;
begin
  -- Community rides are complimentary: pin every fresh insert to 0 and skip the
  -- sticker-price logic entirely. (UPDATEs are untouched, so staff can still
  -- reprice by hand in the rare case they need to.)
  select coalesce(s.event_kind,'') into _kind from sessions s where s.id = new.session_id;
  if _kind = 'community' then
    new.price := 0;
    return new;
  end if;

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

-- (trigger trg_enforce_booking_price already exists and points at this function;
--  recreate defensively for a fresh project)
drop trigger if exists trg_enforce_booking_price on queue_entries;
create trigger trg_enforce_booking_price
  before insert on queue_entries
  for each row execute function _enforce_booking_price();

-- ── B. Approval is staff-owned, enforced in the database ────────────────────
create or replace function _approval_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- A non-staff client may only ever create a reservation as 'pending' (or null
    -- for ordinary sessions). A crafted insert claiming 'approved' is downgraded.
    if new.approval is not null and new.approval <> 'pending' and not is_staff() then
      new.approval := 'pending';
    end if;
  else
    -- After insert, only staff move approval. A non-staff change is reverted to
    -- the stored value (silently: customer cancel/reschedule updates that don't
    -- touch approval are unaffected, and stale clients don't start erroring).
    if new.approval is distinct from old.approval and not is_staff() then
      new.approval := old.approval;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_approval_guard on queue_entries;
create trigger trg_approval_guard
  before insert or update on queue_entries
  for each row execute function _approval_guard();

-- ── C. Repair: community bookings already stored with a JCC price ───────────
-- Unpaid rows only — if staff actually collected money on one, leave the record
-- of that as-is for the audit trail.
update queue_entries q
   set price = 0
  from sessions s
 where s.id = q.session_id
   and coalesce(s.event_kind,'') = 'community'
   and coalesce(q.paid,false) = false
   and coalesce(q.price,0) <> 0;
