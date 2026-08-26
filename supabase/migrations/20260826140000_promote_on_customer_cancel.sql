-- ─────────────────────────────────────────────────────────────────────────────
-- A place freed by the RIDER's own cancellation reaches the waitlist.
--
-- Staff cancel, no-show and removal all promote the next waitlisted rider from
-- the client. A customer cannot: queue_entries UPDATE is is_staff()-only, so
-- their write matches no policy, affects zero rows and returns NO ERROR. Wiring
-- the client call into that path would have looked fixed and done nothing.
--
-- Doing it server-side runs into a second problem, which is the reason this
-- migration touches _capacity_guard at all. The guard counts every row that is
-- not cancelled/removed/noshow — and that INCLUDES waitlist rows. A session
-- with anyone waiting is therefore at or over its cap by definition, so the
-- guard sees a promotion (waitlist -> waiting) as one rider too many and puts
-- them straight back. Verified on staging before this was written: the update
-- reported success and the row was still 'waitlist' afterwards.
--
-- A promotion takes no NEW place — the row was already counted while it waited
-- — so the guard is taught to recognise one. The flag is transaction-local
-- (set_config's third argument is is_local), so it cannot outlive the statement
-- that set it, and _promote_next_waitlist is revoked from anon/authenticated so
-- it cannot be called directly to walk the whole waitlist forward.
--
-- Verified on the staging project against a faithful copy of the schema:
--   A. a genuine new booking on a full session is STILL waitlisted   (capacity intact)
--   B. cancelling a waitlisted booking promotes nobody               (no place freed)
--   C. one freed place promotes exactly one rider, W1 by waitlist_num
--   D. an approval ride never auto-promotes                          (staff pick those)
--   E. the promoted booking consumes its add-on stock exactly once
--
-- Rollback: re-apply the previous bodies of _capacity_guard and
-- customer_booking_update (both are in git history), then
--   drop function if exists public._promote_next_waitlist(text);
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._capacity_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
declare cap int; live int;
begin
  -- A promotion moves a rider from waitlist to waiting and takes no new place:
  -- the row was already counted against capacity while it waited.
  if coalesce(current_setting('mm.promoting', true), '') = '1' then return new; end if;

  if new.status='waiting' and coalesce(new.type_preference,'')<>'Own' and not is_staff() then
    select coalesce(s.capacity,12) into cap from sessions s
      where s.id=new.session_id and coalesce(s.needs_approval,false)=false;
    if cap is not null then
      perform pg_advisory_xact_lock(hashtext('cap:'||new.session_id));
      select count(*) into live from queue_entries q
        where q.session_id=new.session_id
          and coalesce(q.status,'') not in ('cancelled','removed','noshow')
          and coalesce(q.type_preference,'')<>'Own';
      if live>=cap then new.status:='waitlist'; end if;
    end if;
  end if;
  return new;
end$function$;

CREATE OR REPLACE FUNCTION public._promote_next_waitlist(p_session_id text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _appr boolean; _row queue_entries%rowtype; _n int;
begin
  select coalesce(needs_approval,false) into _appr from sessions where id = p_session_id;
  if not found or _appr then return null; end if;   -- staff pick riders on an approval ride

  perform pg_advisory_xact_lock(hashtext('promote:'||p_session_id));

  select * into _row from queue_entries
   where session_id = p_session_id and status = 'waitlist'
   order by coalesce(waitlist_num, 2147483647), registered_at
   limit 1;
  if not found then return null; end if;

  perform set_config('mm.promoting','1',true);
  update queue_entries set status='waiting' where id = _row.id and status='waitlist';
  get diagnostics _n = row_count;
  perform set_config('mm.promoting','',true);
  if _n = 0 then return null; end if;   -- another device got there first

  -- The promoted booking now holds its add-on stock; a waitlisted one held none.
  -- Best-effort: malformed add-ons must not block the promotion itself.
  begin
    update inventory i set qty = i.qty - a.q
      from (select x->>'id' as id, greatest(1, coalesce((x->>'qty')::int,1)) as q
              from jsonb_array_elements(coalesce(nullif(_row.addons,'')::jsonb,'[]'::jsonb)) x) a
     where i.id = a.id;
  exception when others then null;
  end;

  return _row.id;
end $function$;

revoke all on function public._promote_next_waitlist(text) from public, anon, authenticated;

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
    assigned_bike_id = case when p_patch ? 'assigned_bike_id' then null                              else q.assigned_bike_id end
  where q.id = p_entry_id;

  -- Only a rider who was HOLDING a place frees one. A waitlisted booking that
  -- cancels frees no riding place, and a re-cancel frees nothing at all.
  if (p_patch ? 'status') and p_patch->>'status' = 'cancelled'
     and coalesce(_old_status,'') in ('waiting','active') then
    perform _promote_next_waitlist(_sess);
  end if;

  return true;
end $function$;
