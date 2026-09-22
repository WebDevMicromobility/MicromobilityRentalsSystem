-- Why a rider cancelled, kept on the booking so staff and the reports can see it.
--
-- The rider picks a reason when they cancel from My Bookings. Until now it was written to the
-- rider's own browser (localStorage) and nowhere else, so nobody at the desk ever saw it.
--
--   cancel_reason  a short code for the reason picked: plans, work, unwell, weather,
--                  wrong_date, transport, group, price, other. Codes, not sentences, so a
--                  report counts the same reason whichever of the ten languages it was
--                  picked in, and the desk reads it in their own.
--   cancel_note    the rider's own words when they picked Other (300 characters at most).
--
-- Both are written only through customer_booking_update, only on the write that cancels, and
-- cleared when a later write puts the booking back (undo). A malformed code is dropped, never
-- refused: a cancel must not fail over its reason.
--
-- queue_public lists its columns one by one, so neither column reaches anyone but staff.
-- The function header is copied from pg_get_functiondef on prod (SECURITY DEFINER, search_path)
-- so CREATE OR REPLACE keeps its attributes - see supabase/checks/security-attributes.sql.

alter table public.queue_entries add column if not exists cancel_reason text;
alter table public.queue_entries add column if not exists cancel_note text;

alter table public.queue_entries drop constraint if exists queue_entries_cancel_reason_chk;
alter table public.queue_entries add constraint queue_entries_cancel_reason_chk
  check (cancel_reason is null or cancel_reason ~ '^[a-z_]{1,24}$');
alter table public.queue_entries drop constraint if exists queue_entries_cancel_note_chk;
alter table public.queue_entries add constraint queue_entries_cancel_note_chk
  check (cancel_note is null or char_length(cancel_note) <= 300);

CREATE OR REPLACE FUNCTION public.customer_booking_update(p_id text, p_token text, p_entry_id text, p_patch jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare _old_status text; _sess text; _to sessions%rowtype; _today text;
  _cancelling boolean := coalesce(p_patch->>'status','') = 'cancelled';
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  if not exists(select 1 from queue_entries where id = p_entry_id and customer_id = p_id) then return false; end if;
  if (p_patch ? 'status') and (p_patch->>'status') not in ('cancelled','waiting','waitlist') then return false; end if;

  if p_patch ? 'session_id' then
    _today := to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD');
    select * into _to from sessions where id = p_patch->>'session_id';
    if _to.id is null
       or coalesce(_to.status,'') not in ('open','full')
       or (coalesce(_to.event_kind,'') = 'community' and coalesce(_to.needs_approval,false))
       or _to.session_date < _today then
      return false;
    end if;
  end if;

  select status, session_id into _old_status, _sess from queue_entries where id = p_entry_id;

  update queue_entries q set
    type_preference  = coalesce(p_patch->>'type_preference', q.type_preference),
    price            = coalesce((p_patch->>'price')::numeric, q.price),
    size             = coalesce(p_patch->>'size', q.size),
    height           = coalesce((p_patch->>'height')::int, q.height),
    status           = coalesce(p_patch->>'status', q.status),
    queue_num        = coalesce((p_patch->>'queue_num')::int, q.queue_num),
    promo_code       = coalesce(p_patch->>'promo_code', q.promo_code),
    session_id       = case when p_patch ? 'session_id' then _to.id       else q.session_id   end,
    session_day      = case when p_patch ? 'session_id' then _to.day      else q.session_day  end,
    session_date     = case when p_patch ? 'session_id' then coalesce(_to.session_date, _to.id) else q.session_date end,
    rating_bike      = case when p_patch ? 'rating_bike' then nullif(p_patch->>'rating_bike','')::int else q.rating_bike end,
    rating_exp       = case when p_patch ? 'rating_exp'  then nullif(p_patch->>'rating_exp','')::int  else q.rating_exp end,
    feedback         = case when p_patch ? 'feedback'    then p_patch->>'feedback'                    else q.feedback end,
    addons           = case when p_patch ? 'addons'      then p_patch->>'addons'                      else q.addons end,
    assigned_bike_id = case when p_patch ? 'assigned_bike_id' then null                              else q.assigned_bike_id end,
    cancelled_by     = case when _cancelling then 'customer' else q.cancelled_by end,
    cancel_reason    = case
                         when _cancelling then case when (p_patch->>'cancel_reason') ~ '^[a-z_]{1,24}$' then p_patch->>'cancel_reason' else null end
                         when p_patch ? 'status' then null
                         else q.cancel_reason end,
    cancel_note      = case
                         when _cancelling then left(nullif(btrim(coalesce(p_patch->>'cancel_note','')),''), 300)
                         when p_patch ? 'status' then null
                         else q.cancel_note end
  where q.id = p_entry_id;

  if (p_patch ? 'session_id') and _sess is distinct from _to.id
     and coalesce(_old_status,'') in ('waiting','active') then
    perform _promote_next_waitlist(_sess);
  end if;
  if (p_patch ? 'status') and p_patch->>'status' = 'cancelled'
     and coalesce(_old_status,'') in ('waiting','active') then
    perform _promote_next_waitlist(_sess);
  end if;

  return true;
end $function$;
