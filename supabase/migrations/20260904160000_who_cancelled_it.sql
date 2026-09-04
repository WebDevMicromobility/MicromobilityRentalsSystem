-- ─────────────────────────────────────────────────────────────────────────────
-- Who cancelled it.
--
-- Every cancelled booking has read "Cancelled by Customer" since the beginning,
-- because the label was hardcoded to the STATUS: there has never been anywhere
-- to record who actually did it. 516 rows carry that label today, including
-- every booking staff cancelled themselves and all 37 they rejected outright.
--
-- queue_entries.cancelled_by holds 'staff' or 'customer'. Null means unknown,
-- and the app shows those as a plain "Cancelled" rather than inventing an
-- attribution — which is exactly the bug being fixed, so it must not be
-- reintroduced by a hopeful backfill.
--
-- The customer side is stamped SERVER-side, inside customer_booking_update:
-- anything arriving through that RPC is the account holder acting on their own
-- booking, by definition. Staff writes go direct to the table and stamp
-- 'staff' from the client. A customer therefore cannot label their own
-- cancellation as staff's, and vice versa.
--
-- BACKFILL, deliberately narrow: approval='rejected' can only have been set by
-- a staff rejection, so those 37 are marked 'staff'. Nothing else is inferred.
-- The remaining 479 stay null: unknown is the truth about them.
--
-- Rollback:
--   alter table public.queue_entries drop column if exists cancelled_by;
--   (and re-apply the previous customer_booking_update from git history)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.queue_entries add column if not exists cancelled_by text;

comment on column public.queue_entries.cancelled_by is
  'Who cancelled: staff | customer. Null = unknown (every cancellation before 2026-09-04, except rejections). Set server-side for customers by customer_booking_update.';

update queue_entries set cancelled_by = 'staff'
 where status = 'cancelled' and approval = 'rejected' and cancelled_by is null;

CREATE OR REPLACE FUNCTION public.customer_booking_update(p_id text, p_token text, p_entry_id text, p_patch jsonb)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
declare _old_status text; _sess text;
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  if not exists(select 1 from queue_entries where id = p_entry_id and customer_id = p_id) then return false; end if;
  if (p_patch ? 'status') and (p_patch->>'status') not in ('cancelled','waiting','waitlist') then return false; end if;

  -- read before the write, so the promotion below can tell whether this
  -- cancellation actually gave a riding place back
  select status, session_id into _old_status, _sess from queue_entries where id = p_entry_id;

  update queue_entries q set
    type_preference  = coalesce(p_patch->>'type_preference', q.type_preference),
    price            = coalesce((p_patch->>'price')::numeric, q.price),
    size             = coalesce(p_patch->>'size', q.size),
    height           = coalesce((p_patch->>'height')::int, q.height),
    status           = coalesce(p_patch->>'status', q.status),
    queue_num        = coalesce((p_patch->>'queue_num')::int, q.queue_num),
    promo_code       = coalesce(p_patch->>'promo_code', q.promo_code),
    rating_bike      = case when p_patch ? 'rating_bike' then nullif(p_patch->>'rating_bike','')::int else q.rating_bike end,
    rating_exp       = case when p_patch ? 'rating_exp'  then nullif(p_patch->>'rating_exp','')::int  else q.rating_exp end,
    feedback         = case when p_patch ? 'feedback'    then p_patch->>'feedback'                    else q.feedback end,
    addons           = case when p_patch ? 'addons'      then p_patch->>'addons'                      else q.addons end,
    assigned_bike_id = case when p_patch ? 'assigned_bike_id' then null                              else q.assigned_bike_id end,
    -- Stamped here, not taken from the patch: reaching this function IS the proof.
    cancelled_by     = case when coalesce(p_patch->>'status','') = 'cancelled' then 'customer' else q.cancelled_by end
  where q.id = p_entry_id;

  -- Only a rider who was HOLDING a place frees one. A waitlisted booking that
  -- cancels frees no riding place, and a re-cancel frees nothing at all.
  if (p_patch ? 'status') and p_patch->>'status' = 'cancelled'
     and coalesce(_old_status,'') in ('waiting','active') then
    perform _promote_next_waitlist(_sess);
  end if;

  return true;
end $function$;
