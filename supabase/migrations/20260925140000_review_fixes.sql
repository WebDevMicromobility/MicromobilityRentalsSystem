-- ============================================================================
-- Database fixes from the 2026-09-25 review (functions, triggers, policies, grants).
--
--   1. customer_oauth_login: the first Google/Apple sign-in to an account made with a password
--      ends that password and its sessions (an account opened in someone else's email could be
--      kept open by whoever made it). Staff can set a password again (staff_set_customer_password).
--   2. customer_booking_update: a paid booking takes no dearer bike from the rider's phone; an
--      on-the-house row's perk is decided from the account; an own bike swapped for one of ours
--      needs a free place, and swapped back frees one; a cancelled request on an approval ride
--      comes back as a request; add-ons already handed over are not taken off, and a rider's own
--      add-ons are capped at 20 items and 20 of one.
--   3. _ip_gate counts per window: a steady trickle no longer locks a shared network out.
--   4. _enforce_booking_price: a booking restored after a cancel re-checks its promo code.
--   5. Sign-up, Google/Apple sign-up and a profile change of phone or email are metered per
--      network (they answer whether an account exists); new passwords use bcrypt cost 10.
--   6. rider_edit refuses while a companion is out on a bike.
--   7. _approval_guard lets anyone set a booking back to 'pending'.
--   8. A rider's own add-ons are capped at 20 per item (in 2); a promotion takes add-on stock once.
--   9. inventory.cost is not selectable by anon/authenticated (20260922124000 step 2b).
--  10. customer_create_booking refuses a night already past.
--  11. club_rides leaves private (tag-gated) events out.
--  12. error_log: metered per network, lines cut to size.
--  13. customer_reset compares the last nine digits of the phone, not any seven.
--  14. staff_set_customer_password hashes at bcrypt cost 10.
--  15. customers.password_hash and session_token are not selectable from the API.
--  16. customer_profile also answers hidden_types and default_pay.
--
-- Every function is its live definition (supabase db dump, 2026-09-25) with the changes above;
-- attributes (SECURITY DEFINER, search_path) come with it. Run supabase/checks/security-attributes.sql after.
-- ============================================================================

-- ── 1. A Google or Apple sign-in ends a password nobody proved (pre-hijack) ─────────────────
CREATE OR REPLACE FUNCTION "public"."customer_oauth_login"("p_email" "text") RETURNS TABLE("id" "text", "name" "text", "email" "text", "phone" "text", "height" integer, "type_preference" "text", "created_at" "text", "birth_date" "text", "country" "text", "city" "text", "photo" "text", "session_token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare r customers%rowtype; tok text; prov text := coalesce(auth.jwt()->'app_metadata'->>'provider','');
begin
  -- Only a login Google or Apple vouched for: an email-and-password Supabase login carries an
  -- email nobody may have confirmed, and must never open the rider account with that email.
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> lower(p_email)
     or prov not in ('google','apple') then return; end if;
  -- The main email first; an Apple relay address kept beside a real email second.
  select * into r from customers
   where lower(customers.email) = lower(p_email) or lower(customers.apple_email) = lower(p_email)
   order by coalesce(lower(customers.email) = lower(p_email), false) desc
   limit 1;
  if not found then return; end if;
  if coalesce(r.password_hash,'') like 'oauth:%' then
    tok := coalesce(nullif(r.session_token,''), encode(gen_random_bytes(24),'hex'));
    update customers set session_token = tok where customers.id = r.id;
  else
    -- The first Google or Apple sign-in to an account made with a password. Nothing proved that
    -- whoever chose that password owns this email; Google or Apple just did. The unproven
    -- password and every session made with it end here, so an account set up in someone else's
    -- name cannot be kept open by the one who set it up. Staff can give it a password again.
    tok := encode(gen_random_bytes(24),'hex');
    update customers set session_token = tok, password_hash = 'oauth:' || prov, must_change_pwd = false
     where customers.id = r.id;
  end if;
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $$;


-- ── 2. A booking edit keeps paid fares, capacity and approvals ──────────────────────────────
CREATE OR REPLACE FUNCTION "public"."customer_booking_update"("p_id" "text", "p_token" "text", "p_entry_id" "text", "p_patch" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
declare
  q queue_entries%rowtype; _to sessions%rowtype; _at sessions%rowtype; _p jsonb; _today text;
  _want text; _new_status text; _move boolean := false; _qnum int; _live int;
  _type text; _size text; _h int; _name text; _addons text; _set_addons boolean := false;
  _code text; _unpay boolean := false; _rb int; _re int; _cancelling boolean;
  _cu customers%rowtype; _dp text; _house text; _reapprove boolean := false; _to_own boolean := false;
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  _p := coalesce(p_patch, '{}'::jsonb);
  if jsonb_typeof(_p) <> 'object' then return false; end if;
  select * into q from queue_entries x where x.id = p_entry_id and x.customer_id = p_id for update;
  if not found then return false; end if;
  select * into _cu from customers where customers.id = p_id;
  _today := to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD');

  -- price, queue_num and assigned_bike_id are never taken from a customer: the price trigger
  -- prices, the server numbers, and only staff hand out bikes. They are ignored, not refused,
  -- so an older app that still sends them keeps working.
  _want := nullif(_p->>'status', '');
  if _want = q.status then _want := null; end if;   -- restating the status changes nothing
  if _want is not null and _want not in ('cancelled','waiting','waitlist') then return false; end if;

  if _p ? 'session_id' and (_p->>'session_id') is distinct from q.session_id then
    -- A move to another night: a waiting or waitlisted booking only, into a night taking
    -- bookings that the app itself offers (never an approval ride, never the National Day
    -- ride, never one gated on a tag this rider lacks), and never into the past.
    if q.status not in ('waiting','waitlist') or _want = 'cancelled' then return false; end if;
    select * into _at from sessions where sessions.id = q.session_id;
    select * into _to from sessions where sessions.id = _p->>'session_id';
    if _to.id is null
       or coalesce(_to.status,'') not in ('open','full')
       or coalesce(_to.needs_approval,false) or coalesce(_at.needs_approval,false)
       or coalesce(_to.ride_kind,'') = 'snd96' or coalesce(_at.ride_kind,'') = 'snd96'
       or _to.session_date < _today
       or (_to.required_tag_id is not null and not exists (
             select 1 from customer_tags ct
              where ct.customer_id = p_id and ct.tag_id = _to.required_tag_id
                and _ctag_active(ct.starts_at, ct.expires_at))) then
      return false;
    end if;
    _move := true;
    -- A night staff marked Full takes the rider on its waitlist; otherwise they arrive as
    -- 'waiting' and _capacity_guard decides, exactly as for a new booking.
    _new_status := case when coalesce(_to.status,'') = 'full' or _want = 'waitlist' then 'waitlist' else 'waiting' end;
    -- A fresh number in the new session, issued the way queue_entries_assign_qnum issues one.
    update sessions
       set last_qnum = greatest(coalesce(last_qnum, 0),
                                coalesce((select max(x.queue_num) from queue_entries x where x.session_id = _to.id), 0)) + 1
     where sessions.id = _to.id
     returning last_qnum into _qnum;
  elsif _want = 'cancelled' then
    -- A booking that is out on its ride, or done, is staff's to close, not the rider's.
    if q.status not in ('waiting','waitlist') then return false; end if;
    _new_status := 'cancelled';
  elsif _want in ('waiting','waitlist') then
    -- Taking back a cancellation: only the rider's own, on a night still taking bookings.
    if q.status <> 'cancelled' or coalesce(q.cancelled_by,'') <> 'customer' then return false; end if;
    select * into _at from sessions where sessions.id = q.session_id;
    if _at.id is null or coalesce(_at.status,'') not in ('open','full') or _at.session_date < _today then
      return false;
    end if;
    -- The per-account rules a new booking meets (their triggers fire only on insert or a move).
    if coalesce(_at.event_kind,'') = 'community' then
      if not coalesce(_at.open_to_all,false) and not exists (
           select 1 from customer_tags ct join tags tg on tg.id = ct.tag_id
            where ct.customer_id = p_id and lower(tg.slug) = 'saturday'
              and _ctag_active(ct.starts_at, ct.expires_at)) then
        return false;
      end if;
      select count(*) into _live from queue_entries x
       where x.session_id = q.session_id and x.customer_id = p_id and x.id <> q.id
         and coalesce(x.status,'') not in ('cancelled','removed','noshow');
      if _live >= (case when coalesce(_at.needs_approval,false) then 1 else 2 end) then return false; end if;
    end if;
    -- Back to a place only if one is free by the count every booking meets; else the waitlist.
    _new_status := case when _want = 'waiting' and _session_has_room(q.session_id, q.type_preference, q.id)
                        then 'waiting' else 'waitlist' end;
    -- On a ride staff approve, the place given up is theirs to give again: the booking comes back
    -- as a request, not with the approval it had before the cancel.
    _reapprove := coalesce(_at.needs_approval, false);
    -- Its old number may have gone to someone else while it was cancelled.
    if exists (select 1 from queue_entries x
                where x.session_id = q.session_id and x.queue_num = q.queue_num and x.id <> q.id
                  and x.status not in ('cancelled','removed','noshow')) then
      update sessions
         set last_qnum = greatest(coalesce(last_qnum, 0),
                                  coalesce((select max(x.queue_num) from queue_entries x where x.session_id = q.session_id), 0)) + 1
       where sessions.id = q.session_id
       returning last_qnum into _qnum;
    end if;
  end if;

  -- Details of a booking that is still ahead (Edit booking in My Rides).
  if q.status in ('waiting','waitlist') and coalesce(_new_status,'') <> 'cancelled' then
    if _p ? 'type_preference' and _type_ok(_p->>'type_preference') then _type := _p->>'type_preference'; end if;
    if _p ? 'size' and coalesce(_p->>'size','') in ('','XS','S','M','L','XL') then _size := coalesce(_p->>'size',''); end if;
    if (_p->>'height') ~ '^[0-9]{3}$' and (_p->>'height')::int between 100 and 250 then _h := (_p->>'height')::int; end if;
    if _p ? 'name' then
      _name := nullif(left(btrim(regexp_replace(coalesce(_p->>'name',''), '\s+', ' ', 'g')), 60), '');
    end if;
    if _p ? 'promo_code' then
      -- A code is added to a booking once, never swapped for another.
      _code := nullif(btrim(coalesce(_p->>'promo_code','')), '');
      if _code is null or _code !~ '^[A-Za-z0-9_-]{1,40}$' or coalesce(q.promo_code,'') <> '' then _code := null; end if;
    end if;
    -- A paid booking keeps what was paid for. An on-the-house row (paid, nothing charged, no
    -- code) stays free for a bike the account's perk covers and goes back to paying for any
    -- other - decided here from the account, not from what the device sends - and pays too once
    -- renamed away from the account holder, whose perk it is. A row paid in money takes no
    -- dearer bike from here: the desk hands that one over and takes the difference.
    if q.paid and coalesce(q.price,0) = 0 and coalesce(q.promo_code,'') = '' then
      if _type is not null and _type is distinct from q.type_preference then
        _dp := coalesce(_cu.default_pay, '');
        _house := case when _dp = 'house' then 'all' when _dp like 'house:%' then substring(_dp from 7) end;
        if _house is null or not (_house = 'all' or _type = any(string_to_array(_house, ','))) then _unpay := true; end if;
      end if;
      if _name is not null and lower(btrim(coalesce(q.name,''))) = lower(btrim(coalesce(_cu.name,'')))
         and lower(_name) <> lower(btrim(coalesce(_cu.name,''))) then
        _unpay := true;
      end if;
    elsif q.paid and _type is not null and _type is distinct from q.type_preference
          and coalesce(_fare_now(q.session_id, q.id, _type), 0) > coalesce(q.price, 0) then
      return false;
    end if;
  end if;
  if _p ? 'addons' and q.status in ('waiting','waitlist','active') and coalesce(_new_status,'') <> 'cancelled' then
    _addons := nullif(_p->>'addons','');
    _set_addons := _addons is null or _addons_ok(_addons);
    -- A rider's own add-ons: 20 items and 20 of one at most (the app's cap), or one account
    -- could hold the whole stock of every item. Staff are not capped (_addons_ok, the table's
    -- CHECK, allows more).
    if _set_addons and _addons is not null and (
         jsonb_array_length(_addons::jsonb) > 20
         or exists (select 1 from jsonb_each_text(_addon_map(_addons)) m where m.value::int > 20)) then
      _set_addons := false;
    end if;
    -- Goods already handed over stay on the bill: on a ride that is out, add-ons are added,
    -- never taken off (taking one off also gave its stock back).
    if _set_addons and q.status = 'active' and exists (
         select 1 from jsonb_each_text(_addon_map(q.addons)) o
          where coalesce((_addon_map(_addons)->>o.key)::int, 0) < o.value::int) then
      _set_addons := false;
    end if;
  end if;
  if _p ? 'rating_bike' then
    _rb := case when (_p->>'rating_bike') ~ '^[0-9]{1,2}$' and (_p->>'rating_bike')::int between 1 and 10 then (_p->>'rating_bike')::int end;
  end if;
  if _p ? 'rating_exp' then
    _re := case when (_p->>'rating_exp') ~ '^[0-9]{1,2}$' and (_p->>'rating_exp')::int between 1 and 10 then (_p->>'rating_exp')::int end;
  end if;

  -- The rider's reason (20260922130000): kept only on the write that cancels, a malformed code
  -- dropped rather than refused, and cleared by any later write that sets a status (a restore).
  -- Restating 'cancelled' on a cancellation that is already the rider's own may reword it;
  -- a cancellation staff made is not the rider's to annotate.
  _cancelling := coalesce(_p->>'status','') = 'cancelled'
                 and (_new_status = 'cancelled' or (q.status = 'cancelled' and coalesce(q.cancelled_by,'') = 'customer'));

  -- An own bike takes no place on most rides (_capacity_guard), so swapping it for one of ours
  -- needs a place free, the count a new booking meets: the trigger counts only inserts and
  -- moves, and the swap used to put riders past the night's capacity.
  if q.status = 'waiting' and not _move and coalesce(_new_status, 'waiting') = 'waiting'
     and coalesce(q.type_preference, '') = 'Own' and _type is not null and _type <> 'Own'
     and not exists (select 1 from sessions s where s.id = q.session_id
                      and coalesce(s.event_kind, '') = 'community' and coalesce(s.ride_kind, '') = 'petromin')
     and not _session_has_room(q.session_id, _type, q.id) then
    return false;
  end if;
  -- ...and the other way, a bike given up for an own one frees its place for the waitlist.
  _to_own := q.status = 'waiting' and not _move and coalesce(_new_status, 'waiting') = 'waiting'
             and coalesce(q.type_preference, '') <> 'Own' and _type = 'Own';

  update queue_entries x set
    type_preference  = coalesce(_type, x.type_preference),
    size             = coalesce(_size, x.size),
    height           = coalesce(_h, x.height),
    name             = coalesce(_name, x.name),
    paid             = case when _unpay then false else x.paid end,
    status           = coalesce(_new_status, x.status),
    approval         = case when _reapprove then 'pending' else x.approval end,
    queue_num        = coalesce(_qnum, x.queue_num),
    promo_code       = coalesce(_code, x.promo_code),
    -- The move itself. session_day/date follow the row we just validated, never the client's.
    session_id       = case when _move then _to.id else x.session_id end,
    session_day      = case when _move then _to.day else x.session_day end,
    session_date     = case when _move then _to.session_date else x.session_date end,
    waitlist_num     = case when _move then null else x.waitlist_num end,
    rating_bike      = case when _p ? 'rating_bike' then _rb else x.rating_bike end,
    rating_exp       = case when _p ? 'rating_exp'  then _re else x.rating_exp end,
    feedback         = case when _p ? 'feedback'    then left(nullif(_p->>'feedback',''), 1000) else x.feedback end,
    addons           = case when _set_addons then _addons else x.addons end,
    -- A bike held for a booking that is cancelled is let go (only waiting rows cancel, so it
    -- never went out).
    assigned_bike_id = case when _new_status = 'cancelled' then null else x.assigned_bike_id end,
    -- Stamped here, not taken from the patch: reaching this function IS the proof.
    cancelled_by     = case when _new_status = 'cancelled' then 'customer'
                            when x.status = 'cancelled' and _new_status in ('waiting','waitlist') then null
                            else x.cancelled_by end,
    cancel_reason    = case
                         when _cancelling then case when (_p->>'cancel_reason') ~ '^[a-z_]{1,24}$' then _p->>'cancel_reason' else null end
                         when _p ? 'status' then null
                         else x.cancel_reason end,
    cancel_note      = case
                         when _cancelling then left(nullif(btrim(coalesce(_p->>'cancel_note','')),''), 300)
                         when _p ? 'status' then null
                         else x.cancel_note end
  where x.id = q.id;

  -- A rider who held a place and gave it up - a cancel or a move - frees it for the waitlist.
  -- _promote_next_waitlist checks for itself that a place really is free.
  if (q.status = 'waiting' and (_new_status = 'cancelled' or _move)) or _to_own then
    perform _promote_next_waitlist(q.session_id);
  end if;

  return true;
end $_$;


-- ── 3. The per-network meter counts per window ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "public"."_ip_gate"("p_prefix" "text", "p_max" integer, "p_window" interval) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare k text := p_prefix || ':' || _client_ip(); thr login_throttle%rowtype;
begin
  -- About one call in fifty sweeps rows nobody has touched for a day and that hold no lock.
  if random() < 0.02 then
    delete from login_throttle
     where updated_at < now() - interval '1 day'
       and (locked_until is null or locked_until < now());
  end if;
  select * into thr from login_throttle where identifier = k;
  if thr.locked_until is not null and thr.locked_until > now() then return false; end if;
  -- updated_at is when the window opened, not the last call. Stamped on every call, it restarted
  -- the window only after a whole window of silence, so a steady trickle (a shared network
  -- asking every few minutes) was counted for ever and locked out: p_max calls per window now.
  insert into login_throttle as l (identifier, fails, locked_until, updated_at)
    values (k, 1, null, now())
    on conflict (identifier) do update
      set fails        = case when (l.locked_until is not null and l.locked_until <= now()) or l.updated_at < now() - p_window
                              then 1 else coalesce(l.fails, 0) + 1 end,
          locked_until = null,
          updated_at   = case when (l.locked_until is not null and l.locked_until <= now()) or l.updated_at < now() - p_window
                              then now() else l.updated_at end
    returning * into thr;
  if thr.fails >= p_max then
    -- The rest of this window is closed.
    update login_throttle set locked_until = greatest(thr.updated_at + p_window, now() + interval '1 second') where identifier = k;
  end if;
  return true;
end $$;


-- ── 4. A restored booking re-checks its promo code ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION "public"."_enforce_booking_price"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare canonical numeric; _kind text; _paid boolean; _ride_kind text;
        _c promo_codes%rowtype; _fresh boolean; _base numeric; _old_c numeric;
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

    -- An edit that moves nothing a fare depends on keeps the price the row carries. Customers
    -- cannot write price (customer_booking_update ignores it), so the stored figure is this
    -- trigger's own, or staff's, or the registration link's (_rider_link_reprice) - and
    -- re-deriving it here is what used to strip a capped code from its last rider.
    if tg_op = 'UPDATE'
       and new.session_id is not distinct from old.session_id
       and new.type_preference is not distinct from old.type_preference
       and lower(coalesce(new.promo_code, '')) = lower(coalesce(old.promo_code, ''))
       and not (coalesce(old.paid, false) and not coalesce(new.paid, false))
       -- A booking back from a cancel checks its code again: the cancel gave the use back, and
       -- keeping the price here took the discount past the code's limit.
       and not (coalesce(old.status, '') in ('cancelled', 'removed') and coalesce(new.promo_code, '') <> '') then
      new.price := least(greatest(coalesce(new.price, 0), 0), 1000);
      return new;
    end if;

    -- An employee from the ride's own registration form rides at the employee fare;
    -- everyone else, website bookings included, at the standard fare.
    canonical := _fare_now(new.session_id, new.id, new.type_preference);
    if canonical is null and coalesce(new.type_preference, '') <> 'Own' then
      select max(price) into canonical from ride_prices;
    end if;

    if canonical is null then
      -- An own bike is no rental: a customer does not name a price for one; staff may.
      if coalesce(new.promo_code, '') <> '' then new.promo_code := null; end if;
      new.price := case when (select is_staff()) then least(greatest(coalesce(new.price, 0), 0), 1000) else 0 end;
      return new;
    end if;

    if coalesce(new.promo_code, '') = '' then
      new.price := canonical;
    else
      _fresh := tg_op = 'INSERT' or lower(coalesce(old.promo_code, '')) <> lower(new.promo_code)
                or coalesce(old.status, '') in ('cancelled', 'removed');
      if _fresh then
        -- A code newly applied must be usable now, by this rider. The row lock makes two
        -- bookings racing for a code's last use take turns, so only one gets it.
        select * into _c from promo_codes c
         where lower(c.code) = lower(new.promo_code)
           and c.active = true
           and (c.expires_at  is null or c.expires_at >= (now() at time zone 'Asia/Riyadh')::date)
           and (c.max_uses    is null or coalesce(c.uses, 0) < c.max_uses)
           and (c.customer_id is null or c.customer_id = new.customer_id)
         order by c.id limit 1
         for update;
      else
        -- The row already carries this code, and its use was counted when it was applied:
        -- an edit re-prices from the code but never re-checks limits it has passed.
        select * into _c from promo_codes c where lower(c.code) = lower(new.promo_code) order by c.id limit 1;
      end if;

      if _c.id is null or (_c.applies_to is not null and _c.applies_to is distinct from new.type_preference) then
        -- A code that is not honoured is not a code this booking carries, so it is never counted.
        new.promo_code := null;
        new.price := canonical;
      elsif _c.kind = 'flat' and _c.applies_to is null then
        if not _fresh then
          -- Keep the rider's share of the booking's discount, on the new fare - and never more
          -- off one rider than the whole code is worth.
          _old_c := _fare_now(old.session_id, old.id, old.type_preference);
          new.price := case when coalesce(_old_c, 0) > 0
                            then least(canonical, greatest(round(coalesce(old.price, _old_c) * canonical / _old_c, 2),
                                                           canonical - greatest(coalesce(_c.value, 0), 0)))
                            else canonical end;
        else
          _base := null;
          if tg_op = 'INSERT' and lower(coalesce(current_setting('mm.promo_code', true), '')) = lower(new.promo_code) then
            _base := nullif(current_setting('mm.promo_base', true), '')::numeric;
          end if;
          if _base is null then
            -- No booking total handed down (a code applied after booking, a staff insert):
            -- the rider's other live bookings on this session share the one discount.
            _base := canonical + coalesce((
              select sum(coalesce(_fare_now(q.session_id, q.id, q.type_preference), 0))
                from queue_entries q
               where new.customer_id is not null and q.customer_id = new.customer_id
                 and q.session_id = new.session_id and q.id <> new.id
                 and coalesce(q.status, '') in ('waiting', 'waitlist', 'active')
                 and not coalesce(q.paid, false)), 0);
          end if;
          new.price := _promo_fare(_c, new.type_preference, canonical, _base);
        end if;
      else
        new.price := _promo_fare(_c, new.type_preference, canonical, canonical);
      end if;
    end if;
  end if;

  new.price := least(greatest(coalesce(new.price, 0), 0), 1000);
  return new;
end $$;


-- ── 5a. Sign-up is metered; new passwords are hashed at bcrypt cost 10 ──────────────────────
CREATE OR REPLACE FUNCTION "public"."customer_signup"("p_id" "text", "p_name" "text", "p_email" "text", "p_phone" "text", "p_pwd" "text", "p_height" integer, "p_type_preference" "text", "p_gender" "text") RETURNS TABLE("id" "text", "session_token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
declare tok text;
begin
  -- Sign-up says whether an email or phone already has an account (DUPLICATE), so it is metered
  -- per network, as customer_exists is. Staff adding an account at the desk are not.
  if not (select is_staff()) and not _ip_gate('signup', 20, interval '10 minutes') then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  -- An empty choice is no choice: '' is stored the way the column's own default would be.
  p_gender := nullif(p_gender, '');
  p_type_preference := coalesce(nullif(p_type_preference, ''), 'Any');
  if coalesce(p_id,'') !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'id'; end if;
  if not _type_ok(p_type_preference) then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'type_preference'; end if;
  if p_gender is not null and p_gender not in ('male','female') then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'gender'; end if;
  if p_height is not null and (p_height < 100 or p_height > 250) then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'height'; end if;
  if coalesce(p_phone,'') <> '' and p_phone !~ '^\+?[0-9]{6,15}$' then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'phone'; end if;
  if exists(select 1 from customers
            where (coalesce(p_email,'')<>'' and lower(email)=lower(p_email))
               or (coalesce(p_phone,'')<>'' and phone=p_phone)) then
    raise exception 'DUPLICATE' using errcode = 'unique_violation';
  end if;
  tok := encode(gen_random_bytes(24),'hex');
  insert into customers(id,name,email,phone,password_hash,created_at,height,type_preference,gender,session_token)
  values(p_id,p_name,p_email,p_phone,crypt(p_pwd, gen_salt('bf', 10)),to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         p_height,p_type_preference,p_gender,tok);
  return query select p_id, tok;
end $_$;


-- ── 5b. Google/Apple sign-up is metered ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "public"."customer_oauth_signup"("p_id" "text", "p_name" "text", "p_email" "text", "p_phone" "text", "p_height" integer, "p_type_preference" "text", "p_gender" "text", "p_photo" "text") RETURNS TABLE("id" "text", "session_token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
declare tok text; v_photo text;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> lower(p_email)
     or coalesce(auth.jwt()->'app_metadata'->>'provider','') not in ('google','apple') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  -- The email is the caller's own, but the phone is checked against every account: metered.
  if not _ip_gate('signup', 20, interval '10 minutes') then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  p_gender := nullif(p_gender, '');
  p_type_preference := coalesce(nullif(p_type_preference, ''), 'Any');
  if coalesce(p_id,'') !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'id'; end if;
  if not _type_ok(p_type_preference) then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'type_preference'; end if;
  if p_gender is not null and p_gender not in ('male','female') then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'gender'; end if;
  if p_height is not null and (p_height < 100 or p_height > 250) then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'height'; end if;
  if coalesce(p_phone,'') <> '' and p_phone !~ '^\+?[0-9]{6,15}$' then raise exception 'BAD_INPUT' using errcode = '22023', detail = 'phone'; end if;
  -- The provider's avatar is a link; anything that is not a plain https URL is simply not kept.
  v_photo := case when length(p_photo) <= 2000 and p_photo ~ '^https://[^[:space:]"''<>`\\]+$' then p_photo end;
  if exists(select 1 from customers
            where (coalesce(p_email,'')<>'' and lower(customers.email)=lower(p_email))
               or (coalesce(p_phone,'')<>'' and customers.phone=p_phone)) then
    raise exception 'DUPLICATE' using errcode = 'unique_violation';
  end if;
  tok := encode(gen_random_bytes(24),'hex');
  insert into customers(id,name,email,phone,password_hash,created_at,height,type_preference,gender,photo,session_token)
  values(p_id,p_name,p_email,p_phone,'oauth:google',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         p_height,p_type_preference,p_gender,v_photo,tok);
  return query select p_id, tok;
end $_$;


-- ── 5c. A profile change of phone or email is metered ───────────────────────────────────────
CREATE OR REPLACE FUNCTION "public"."customer_update_profile"("p_id" "text", "p_token" "text", "p_name" "text", "p_email" "text", "p_phone" "text", "p_height" integer, "p_type_preference" "text", "p_birth_date" "text", "p_country" "text", "p_city" "text", "p_nationality" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
declare c customers%rowtype; v_phone text; v_email text;
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  select * into c from customers where customers.id = p_id;
  if not found then return false; end if;

  -- A phone is stored in the shape sign-up and the correction form accept, or cleared; any
  -- other text leaves the stored one. A number another account holds is refused, but only when
  -- it is a change: a few accounts already share one, and they must still save their profile.
  v_phone := nullif(btrim(coalesce(p_phone,'')), '');
  if p_phone is null then v_phone := null;
  elsif v_phone is null then v_phone := '';
  elsif v_phone !~ '^\+?[0-9]{8,15}$' then v_phone := c.phone;
  end if;
  -- A new phone or email is checked against every other account, which answers whether that
  -- one exists: metered per network, as customer_exists is.
  if ((coalesce(v_phone,'') <> '' and v_phone is distinct from c.phone)
      or (nullif(btrim(coalesce(p_email,'')), '') is not null
          and lower(btrim(p_email)) is distinct from lower(btrim(coalesce(c.email,'')))))
     and not _ip_gate('profile', 20, interval '10 minutes') then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  if coalesce(v_phone,'') <> '' and v_phone is distinct from c.phone
     and exists (select 1 from customers o where o.id <> p_id
                  and regexp_replace(coalesce(o.phone,''), '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')) then
    raise exception 'phone_taken' using errcode = '23505';
  end if;
  v_email := nullif(btrim(coalesce(p_email,'')), '');
  if v_email is not null and v_email !~ '^[^[:space:]@<>"''()]+@[^[:space:]@<>"''()]+\.[^[:space:]@<>"''()]+$' then
    v_email := c.email;
  elsif v_email is null then
    v_email := case when p_email is null then null else '' end;
  end if;

  update customers set
    name            = coalesce(nullif(btrim(p_name), ''), c.name),
    email           = v_email,
    phone           = v_phone,
    height          = case when p_height is null then null when p_height between 100 and 250 then p_height else c.height end,
    type_preference = case when _type_ok(p_type_preference) then p_type_preference else c.type_preference end,
    birth_date      = case when nullif(p_birth_date,'') is null then null when _ymd_ok(p_birth_date) then p_birth_date else c.birth_date end,
    country         = left(p_country, 80),
    city            = left(p_city, 120),
    nationality     = left(p_nationality, 80)
  where customers.id = p_id;
  return true;
end $_$;


-- ── 6. A registration with a companion out on a bike is not edited ──────────────────────────
CREATE OR REPLACE FUNCTION "public"."rider_edit"("p_booking_no" "text", "p_proof_phone" "text", "p_badge" "text", "p_name" "text", "p_height" integer, "p_type" "text", "p_session_id" "text" DEFAULT NULL::"text", "p_company" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_riders" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row rider_registrations%rowtype;
  v_proof text := right(regexp_replace(coalesce(p_proof_phone,''), '\D', '', 'g'), 9);
  v_newkey text := lower(regexp_replace(trim(coalesce(p_badge,'')), '[^a-zA-Z0-9]', '', 'g'));
  v_sess_id text;
  v_r jsonb;
  v_seq integer; v_bno text;
begin
  if not _rider_gate() then return jsonb_build_object('ok', false, 'error', 'throttled'); end if;

  -- The same number can be a booking on several nights: the one this phone made, not yet
  -- checked in, on a night still open, the latest first.
  select r.* into v_row from rider_registrations r left join sessions s on s.id = r.session_id
   where upper(r.booking_no) = upper(trim(coalesce(p_booking_no,''))) and r.party_no = 1
   order by (r.phone is not null and right(regexp_replace(r.phone, '\D', '', 'g'), 9) = v_proof) desc,
            (r.checked_in_at is null) desc,
            (coalesce(s.status, '') in ('open', 'full')) desc,
            r.session_id desc nulls last
   limit 1;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  if v_row.phone is null or length(v_proof) < 9 or right(regexp_replace(v_row.phone, '\D', '', 'g'), 9) <> v_proof then
    return jsonb_build_object('ok', false, 'error', 'notfound');
  end if;
  if v_row.checked_in_at is not null then return jsonb_build_object('ok', false, 'error', 'checked_in'); end if;
  -- Nor while a companion is out on a bike: the edit moves the whole party, and moved them off
  -- tonight's roster and billing mid-ride.
  if exists (select 1 from rider_registrations r
              where r.booking_no = v_row.booking_no and coalesce(r.session_id, '') = coalesce(v_row.session_id, '')
                and r.checked_in_at is not null) then
    return jsonb_build_object('ok', false, 'error', 'checked_in');
  end if;

  v_sess_id := coalesce(p_session_id, v_row.session_id);
  if v_newkey = '' then return jsonb_build_object('ok', false, 'error', 'badge'); end if;
  if exists (select 1 from rider_registrations r
              where r.badge_key = v_newkey and coalesce(r.session_id,'') = coalesce(v_sess_id,'') and (r.booking_no is distinct from v_row.booking_no or coalesce(r.session_id, '') is distinct from coalesce(v_row.session_id, ''))) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  -- Sub-transaction: move the row under the new badge and session, then let rider_register()
  -- validate and upsert onto it (same badge_key + session_id, so booking_no is kept). A refusal
  -- is raised out of the block so the moves roll back with it. The phone proof is checked
  -- above, so rider_register is told this booking number is proven (the new phone may differ).
  begin
    -- A move to another night takes that night's next number: every night counts from P-001.
    v_bno := v_row.booking_no;
    if coalesce(v_sess_id, '') <> coalesce(v_row.session_id, '') then
      insert into rider_night_counters(session_key, source, n) values (coalesce(v_sess_id, ''), coalesce(v_row.source, 'petromin'), 1)
        on conflict (session_key, source) do update set n = rider_night_counters.n + 1 returning n into v_seq;
      v_bno := upper(left(coalesce(v_row.source, 'petromin'), 1)) || '-' || lpad(v_seq::text, 3, '0');
    end if;
    perform set_config('mm.rider_proved', v_bno, true);
    update rider_registrations
       set badge = trim(p_badge), session_id = v_sess_id, booking_no = v_bno
     where booking_no = v_row.booking_no and coalesce(session_id, '') = coalesce(v_row.session_id, '');   -- the whole party moves together
    v_r := rider_register(p_badge, p_name, p_height, p_type, coalesce(v_row.source, 'petromin'), p_phone, v_sess_id, p_company, p_riders);
    perform set_config('mm.rider_proved', '', true);
    if not coalesce((v_r->>'ok')::boolean, false) then
      raise exception using errcode = 'MM001', message = v_r::text;
    end if;
  exception when sqlstate 'MM001' then
    perform set_config('mm.rider_proved', '', true);
    return sqlerrm::jsonb;
  end;

  return v_r;
end $$;


-- ── 7. A request back from a cancel waits for approval again ────────────────────────────────
CREATE OR REPLACE FUNCTION "public"."_approval_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Only API requests are gated: they carry the anon or authenticated role. A SECURITY DEFINER
  -- function runs as its owner, so current_user never said who asked; the request's role does.
  -- The SQL editor, service_role and other admin connections pass through.
  if coalesce(auth.role(), '') not in ('anon','authenticated') then return new; end if;
  if tg_op = 'INSERT' then
    if new.approval is not null and new.approval <> 'pending' and not is_staff() then
      new.approval := 'pending';
    end if;
  else
    -- Back to 'pending' gives nothing away: customer_booking_update does it when a cancelled
    -- request on an approval ride comes back.
    if new.approval is distinct from old.approval and new.approval is distinct from 'pending' and not is_staff() then
      new.approval := old.approval;
    end if;
  end if;
  return new;
end $$;


-- ── 8. A promotion takes add-on stock once ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "public"."_promote_next_waitlist"("p_session_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare _s sessions%rowtype; _row queue_entries%rowtype; _n int; _own boolean; _held int; _a jsonb; k text;
begin
  select * into _s from sessions where id = p_session_id;
  if not found or coalesce(_s.needs_approval,false) then return null; end if;   -- staff pick riders on an approval ride

  perform pg_advisory_xact_lock(hashtext('promote:'||p_session_id));

  -- Only into a place that is really free: riders holding one (waiting, out, or done) counted
  -- the way _capacity_guard counts them. An own-bike rider leaving a ride where own bikes take
  -- no place frees nothing, and nor does a booking that came back after the cancel.
  _own := coalesce(_s.event_kind,'') = 'community' and coalesce(_s.ride_kind,'') = 'petromin';
  select count(*) into _held from queue_entries q
   where q.session_id = p_session_id
     and coalesce(q.status,'') not in ('cancelled','removed','noshow','waitlist')
     and (_own or coalesce(q.type_preference,'') <> 'Own');
  if _held >= coalesce(_s.capacity, 12) then return null; end if;

  -- The freed place is a bike: an own-bike waitlister where own bikes take no place is not
  -- who it goes to.
  select * into _row from queue_entries
   where session_id = p_session_id and status = 'waitlist'
     and (_own or coalesce(type_preference,'') <> 'Own')
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
    _a := _addon_map(_row.addons);
    -- Only what the row does not hold already: stock it kept while waitlisted was taken once.
    for k in select jsonb_object_keys(_a) loop
      update inventory i
         set qty = i.qty - greatest((_a->>k)::int - coalesce((coalesce(_row.addons_held, '{}'::jsonb)->>k)::int, 0), 0)
       where i.id = k;
    end loop;
    update queue_entries set addons_held = _a where id = _row.id;
  exception when others then null;
  end;

  return _row.id;
end $$;


-- ── 9. What the shop pays for stock is staff's to see (20260922124000 step 2b) ──────────────
do $$
declare c record;
begin
  revoke select on public.inventory from anon, authenticated;
  for c in
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'inventory' and column_name <> 'cost'
  loop
    execute format('grant select (%I) on public.inventory to anon, authenticated', c.column_name);
  end loop;
end $$;


-- ── 10. A past night takes no booking ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "public"."customer_create_booking"("p_id" "text", "p_token" "text", "p_entries" "jsonb") RETURNS TABLE("id" "text", "queue_num" integer, "status" "text", "waitlist_num" integer, "price" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
declare
  it jsonb; cust customers%rowtype; s sessions%rowtype; _i int;
  _appr boolean; _house text; _house_first boolean := false; _paid boolean;
  _sid text; _status text; _day text; _wv text; _eid text; _gid text; _type text; _size text; _h int;
  _reg text; _ph text; _em text; _code text; _rc text; _pc promo_codes%rowtype; _base numeric := 0;
  _ids text[] := '{}';
begin
  -- The device holds a token this account no longer has. Say so: the app signs
  -- the rider out and asks them to sign in again.
  if not _cust_token_ok(p_id, p_token) then
    raise exception 'STALE_SESSION' using errcode = 'P0001';
  end if;
  select * into cust from customers where customers.id = p_id;
  if not found then
    raise exception 'STALE_SESSION' using errcode = 'P0001';
  end if;

  -- Details this rider still owes - fields staff asked them to correct, or the Apple
  -- check-up - come before any booking (20260921180000).
  if cardinality(coalesce(_customer_asks(p_id), '{}'::text[])) > 0 then
    raise exception 'FIX_FIRST' using errcode = 'P0001';
  end if;

  -- A malformed batch is a client bug, not a rider-facing state: still empty.
  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) = 0 or jsonb_array_length(p_entries) > 10 then
    return;
  end if;

  _sid := p_entries->0->>'session_id';
  select * into s from sessions where sessions.id = _sid and coalesce(sessions.status,'') in ('open','full')
     and coalesce(sessions.session_date, '9999-12-31') >= to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD');
  -- Closed, deleted, gone while the rider sat on the confirm step, or a night already past that
  -- nobody closed.
  if not found then
    raise exception 'SESSION_CLOSED' using errcode = 'P0001';
  end if;
  -- A private event is booked only by an account holding its tag (list_sessions shows it to
  -- no one else); to anyone else it is as closed as a night that does not exist.
  if s.required_tag_id is not null and not exists (
       select 1 from customer_tags ct
        where ct.customer_id = p_id and ct.tag_id = s.required_tag_id
          and _ctag_active(ct.starts_at, ct.expires_at)) then
    raise exception 'SESSION_CLOSED' using errcode = 'P0001';
  end if;

  _appr := coalesce(s.needs_approval,false);
  _status := case when coalesce(s.status,'') = 'full' then 'waitlist' else 'waiting' end;
  _day := case when s.day in ('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') then s.day
               else to_char(s.session_date::date, 'FMDay') end;

  if coalesce(cust.default_pay,'') like 'house%' then
    _house := case when cust.default_pay = 'house' then 'all'
                   else substring(cust.default_pay from 7) end;
  end if;

  -- Every rider is checked before any is written: a bad rider 3 must not leave 1 and 2 booked.
  _i := 0;
  for it in select * from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(it) <> 'object' or it->>'session_id' is distinct from _sid then
      raise exception 'BAD_INPUT' using errcode = '22023', detail = 'session_id';   -- one session per call
    end if;
    _eid := nullif(it->>'id','');
    if _eid is not null and (_eid !~ '^[A-Za-z0-9_-]{1,64}$' or _eid = any(_ids)) then
      raise exception 'BAD_INPUT' using errcode = '22023', detail = 'id';
    end if;
    if _eid is not null then _ids := _ids || _eid; end if;
    _gid := nullif(it->>'group_id','');
    if _gid is not null and _gid !~ '^[A-Za-z0-9_-]{1,64}$' then
      raise exception 'BAD_INPUT' using errcode = '22023', detail = 'group_id';
    end if;
    _type := coalesce(nullif(it->>'type_preference',''), 'Any');
    if not _type_ok(_type) then
      raise exception 'BAD_INPUT' using errcode = '22023', detail = 'type_preference';
    end if;
    -- Free ride only for the FIRST rider, only when the account holder is riding under their
    -- own name, and only for a covered type. Co-riders always pay.
    if _i = 0 and _house is not null
       and lower(btrim(coalesce(it->>'name',''))) = lower(btrim(coalesce(cust.name,'')))
       and (_house = 'all' or _type = any(string_to_array(_house, ','))) then
      _house_first := true;
    end if;
    if _code is null and nullif(it->>'promo_code','') is not null then _code := it->>'promo_code'; end if;
    _i := _i + 1;
  end loop;

  -- A flat code off the whole booking is shared across its riders in proportion to their fares,
  -- the wizard's own split. The price trigger sees one row at a time, so it is handed the total.
  if _code is not null then
    select * into _pc from promo_codes c where lower(c.code) = lower(_code) order by c.id limit 1;
    if _pc.id is not null and _pc.kind = 'flat' and _pc.applies_to is null then
      _i := 0;
      for it in select * from jsonb_array_elements(p_entries) loop
        if not (_i = 0 and _house_first) and lower(coalesce(it->>'promo_code','')) = lower(_code) then
          _base := _base + coalesce(_fare_now(_sid, coalesce(nullif(it->>'id',''), '-'),
                                              coalesce(nullif(it->>'type_preference',''), 'Any')), 0);
        end if;
        _i := _i + 1;
      end loop;
      perform set_config('mm.promo_code', lower(_code), true);
      perform set_config('mm.promo_base', _base::text, true);
    end if;
  end if;

  _i := 0;
  for it in select * from jsonb_array_elements(p_entries) loop
    _paid := (_i = 0 and _house_first);
    _type := coalesce(nullif(it->>'type_preference',''), 'Any');
    _size := coalesce(it->>'size', '');
    if _size not in ('','XS','S','M','L','XL') then _size := ''; end if;
    _h := case when (it->>'height') ~ '^[0-9]{3}$' and (it->>'height')::int between 100 and 250
               then (it->>'height')::int end;
    -- The booking time the device recorded (an offline booking keeps its place in line), if it
    -- is a real ISO time from the last week; otherwise now.
    _reg := it->>'registered_at';
    begin
      if _reg is null or _reg !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$'
         or _reg::timestamptz not between now() - interval '7 days' and now() + interval '10 minutes' then
        _reg := null;
      end if;
    exception when others then _reg := null;
    end;
    _reg := coalesce(_reg, to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
    -- Contact details are the account's unless the rider gave a well-formed one.
    _ph := nullif(btrim(coalesce(it->>'phone','')), '');
    if _ph is null or _ph !~ '^\+?[0-9]{6,15}$' then _ph := coalesce(cust.phone, ''); end if;
    _em := nullif(btrim(coalesce(it->>'email','')), '');
    if _em is null or _em !~ '^[^[:space:]@<>"''()]+@[^[:space:]@<>"''()]+\.[^[:space:]@<>"''()]+$' then
      _em := coalesce(cust.email, '');
    end if;
    -- The version is the client's (only it knows which text it rendered); the TIME is ours.
    _wv := left(nullif(it->>'waiver_version',''), 40);
    if _wv is not null and _wv !~ '^[A-Za-z0-9._-]{1,40}$' then _wv := null; end if;
    _rc := nullif(btrim(coalesce(it->>'promo_code','')), '');
    if _rc is not null and _rc !~ '^[A-Za-z0-9_-]{1,40}$' then _rc := null; end if;

    return query
    insert into queue_entries (
      id, name, size, height, type_preference, session_id, session_day, session_date,
      queue_num, registered_at, phone, email, status, paid, price, promo_code,
      customer_id, walk_in, group_id, approval, assigned_bike_id,
      waiver_at, waiver_version
    ) values (
      coalesce(nullif(it->>'id',''), encode(gen_random_bytes(12),'hex')),
      left(btrim(regexp_replace(coalesce(it->>'name',''), '\s+', ' ', 'g')), 60),
      _size,
      _h,
      _type,
      _sid,
      _day,
      s.session_date,
      0,                                  -- queue_entries_assign_qnum issues the number
      _reg,
      left(_ph, 30),
      left(_em, 120),
      _status,
      _paid,
      case when _paid then 0 end,         -- _enforce_booking_price decides every other price
      _rc,
      p_id,
      false,
      nullif(it->>'group_id',''),
      case when _appr then 'pending' else null end,
      null,
      case when _wv is not null
           then to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"') else null end,
      _wv
    )
    returning queue_entries.id, queue_entries.queue_num, queue_entries.status,
              queue_entries.waitlist_num, queue_entries.price;
    _i := _i + 1;
  end loop;

  perform set_config('mm.promo_code', '', true);
  perform set_config('mm.promo_base', '', true);
end $_$;


-- ── 11. The public club-ride list leaves private events out ─────────────────────────────────
CREATE OR REPLACE FUNCTION "public"."club_rides"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v jsonb;
begin
  if not _ip_gate('clubrides', 60, interval '10 minutes') then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(x order by x->>'date', x->>'time'), '[]'::jsonb) into v from (
    select jsonb_build_object('title', coalesce(nullif(btrim(s.title), ''), ''), 'date', s.session_date,
             'time', substring(coalesce(s.bike_slots, '') from '"_time"\s*:\s*"([^"]*)"'), 'kind', s.ride_kind) as x
      from sessions s
     where s.event_kind = 'community' and s.status = 'open' and coalesce(s.ride_kind, '') <> 'petromin'
       and s.required_tag_id is null   -- a private event is listed only to its members (list_sessions)
       and s.session_date >= to_char((now() at time zone 'Asia/Riyadh')::date, 'YYYY-MM-DD')
     order by s.session_date
     limit 6) t;
  return v;
end $$;


-- ── 12. The error log is metered and its lines are cut to size ──────────────────────────────
create or replace function public._error_log_gate()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- The app reports short lines (what failed, where, the browser). Anything longer is cut, and a
  -- network sending more than 60 in ten minutes is not a page reporting its own errors: the
  -- rest are dropped quietly (anyone may write here, so it must not fill the database).
  if not (select is_staff()) and not _ip_gate('errlog', 60, interval '10 minutes') then return null; end if;
  new.msg := left(new.msg, 500);
  new.src := left(new.src, 500);
  new.ua  := left(new.ua, 300);
  new.at  := left(new.at, 40);
  return new;
end $function$;
revoke all on function public._error_log_gate() from public, anon, authenticated;
drop trigger if exists error_log_gate on public.error_log;
create trigger error_log_gate before insert on public.error_log for each row execute function public._error_log_gate();


-- ── 13. A reset needs the whole phone number ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "public"."customer_reset"("p_email" "text", "p_phone" "text", "p_new_pwd" "text") RETURNS TABLE("id" "text", "name" "text", "email" "text", "phone" "text", "height" integer, "type_preference" "text", "created_at" "text", "birth_date" "text", "country" "text", "city" "text", "photo" "text", "session_token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare r customers%rowtype; tok text; s_digits text; p_digits text; k text; thr login_throttle%rowtype; nfails int;
begin
  -- Keyed on the email, so a known email cannot be brute-forced on the phone check.
  k := 'reset:' || lower(trim(coalesce(p_email, '')));
  select * into thr from login_throttle where identifier = k;
  if thr.locked_until is not null and thr.locked_until > now() then
    raise exception 'LOCKED' using errcode = 'P0001';
  end if;
  -- Over the per-network budget reads as "no match", like customer_exists.
  if not _oracle_gate() then return; end if;

  select * into r from customers where lower(customers.email)=lower(p_email) limit 1;
  if found and coalesce(r.password_hash,'') not like 'oauth:%' then
    s_digits := regexp_replace(coalesce(r.phone,''), '\D', '', 'g');
    p_digits := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
    -- a short or empty phone is never proof of ownership
    -- The number itself, not any seven digits it ends with: the last nine digits must match (a
    -- Saudi mobile is nine after the country code; a shorter number is compared whole).
    if length(p_digits) >= 8 and length(s_digits) >= 8
       and right(s_digits, 9) = right(p_digits, 9)
       and length(coalesce(p_new_pwd,'')) >= 8 then
      delete from login_throttle where identifier = k;   -- success clears the counter
      tok := encode(gen_random_bytes(24),'hex');
      update customers set password_hash=crypt(p_new_pwd, gen_salt('bf', 10)), session_token=tok
       where customers.id=r.id;
      return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
        r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
      return;
    end if;
  end if;

  nfails := (case when (thr.locked_until is not null and thr.locked_until <= now())
                    or thr.updated_at < now() - interval '1 day' then 0
                  else coalesce(thr.fails, 0) end) + 1;
  insert into login_throttle(identifier, fails, locked_until, updated_at)
    values (k, nfails, case when nfails >= 8 then now() + interval '15 minutes' else null end, now())
    on conflict (identifier) do update set fails = excluded.fails, locked_until = excluded.locked_until, updated_at = excluded.updated_at;
  return;
end $$;


-- ── 14. A password staff set is hashed at bcrypt cost 10 ────────────────────────────────────
CREATE OR REPLACE FUNCTION "public"."staff_set_customer_password"("p_customer_id" "text", "p_new_pwd" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  if not is_staff() then return false; end if;
  if length(coalesce(p_new_pwd,'')) < 8 then return false; end if;
  update customers
     set password_hash = crypt(p_new_pwd, gen_salt('bf', 10)),
         session_token = encode(gen_random_bytes(24),'hex')
   where id = p_customer_id;
  return found;
end $$;


-- ── 15. Password hashes and session tokens are not selectable from the API ──────────────────
-- Staff read customers directly (the Accounts list, the booking editor), and used to be able to
-- read these two columns with it: a staff session, or a script injected into the staff page,
-- could list every rider's session token and act as them. The app never asks for either
-- (CUST_REF_COLS, staff_sync); sign-in, sign-up and the token checks read them inside SECURITY
-- DEFINER functions, which column grants do not touch.
do $$
declare c record;
begin
  revoke select on public.customers from anon, authenticated;
  for c in
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'customers' and column_name not in ('password_hash', 'session_token')
  loop
    execute format('grant select (%I) on public.customers to anon, authenticated', c.column_name);
  end loop;
end $$;


-- ── 16. A rider's own device learns their hidden bike types and on-the-house perk ───────────
-- Staff set both on the account (Accounts > edit): hidden_types takes bike types off that rider's
-- booking picker, default_pay 'house[:types]' makes their own ride free. Neither reached the
-- rider's device - the sign-in answers carry neither and the table is staff-only - so the picker
-- showed hidden types and the price summary quoted a fare the booking then did not charge.
-- A new answer column changes the function's type, so it is dropped and made again.
drop function if exists public.customer_profile(text, text);
CREATE FUNCTION "public"."customer_profile"("p_id" "text", "p_token" "text") RETURNS TABLE("id" "text", "name" "text", "email" "text", "phone" "text", "height" integer, "type_preference" "text", "created_at" "text", "birth_date" "text", "country" "text", "city" "text", "photo" "text", "gender" "text", "nationality" "text", "socials" "jsonb", "hidden_types" "text", "default_pay" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  if not _cust_token_ok(p_id,p_token) then return; end if;
  return query select c.id, c.name, c.email, c.phone, c.height, c.type_preference,
    c.created_at, c.birth_date, c.country, c.city, c.photo, c.gender, c.nationality, c.socials,
    c.hidden_types, c.default_pay
  from customers c where c.id = p_id;
end $$;
revoke all on function public.customer_profile(text, text) from public;
grant execute on function public.customer_profile(text, text) to anon, authenticated;
