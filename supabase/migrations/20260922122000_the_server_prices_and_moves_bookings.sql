-- ============================================================================
-- The server prices a booking, and decides what a customer may do with one.
--
-- Found in the 2026-09-22 review, all reachable with the customer's own token:
--
--   A. PRICE. With any valid promo code on the row, _enforce_booking_price kept whatever price
--      the client sent between 0 and the fare - a 5% code bought a free ride - and every code
--      was world-readable (promo_codes "public read"). customer_booking_update also wrote
--      p_patch->>'price' straight in, which stood on any row the trigger does not re-derive
--      (a bike held for it, out on the ride, paid). Now:
--        · the discount is computed here from the code's kind, value and bike type, never
--          taken from the request (a flat code off a whole booking is shared across its riders
--          in proportion to their fares, the wizard's own split, via mm.promo_base);
--        · customers can no longer set price at all (the key is ignored);
--        · promo_codes is readable by staff only; the booking form asks promo_lookup() about
--          the ONE code a rider typed.
--   B. CAPPED CODES. Every customer UPDATE re-checked the code against its limits, and the row
--      itself already held one of its uses, so the last allowed rider lost the discount (and
--      the code) the moment the app re-sent the code after booking - and the use stayed burned.
--      A code a row already carries is no longer re-checked; only a newly applied one is, under
--      a row lock so two bookings cannot both take the last use. The use count now also moves
--      when a code is applied or cleared on an existing booking, not only on insert and cancel.
--   C. STATUS. customer_booking_update accepted 'waiting' on any of the rider's rows, with no
--      capacity check: a waitlisted rider could promote themselves, a rider staff removed or
--      rejected could put themselves back, Undo after a cancel re-seated the rider on top of
--      the waitlister the cancel had just promoted, and a stale screen could cancel a ride that
--      was already out (closing its bike assignment with the bike still on the road). Now a
--      customer may only cancel a waiting/waitlisted booking, and only take back their OWN
--      cancellation, which returns to 'waiting' when a place is free by the count every booking
--      meets and to the waitlist otherwise, under the per-account caps and the members gate.
--      queue_num is never taken from a customer (the key is ignored): a move gets a fresh number
--      in its new session, a restore keeps its old one unless that has been taken. A bike held
--      for a cancelled booking is let go; assigned_bike_id is not patchable.
--   D. MOVES. A reschedule into a session staff marked Full now lands on its waitlist; a move
--      into or out of an approval ride or the National Day ride is refused (the app never
--      offers either), as is a move into a tag-gated session the rider is not tagged for.
--      customer_create_booking refuses a tag-gated session the same way.
--   E. FILL RULE. _session_fill_status recounted only the session a row moved INTO, so the one
--      it left stayed "Fully booked" with a bike free, and the next booking was waitlisted.
--   F. PROMOTION. _promote_next_waitlist promoted whenever it was called. An own-bike rider
--      leaving a ride where own bikes take no place freed nothing, and still seated one more
--      rider than there are bikes; it could also hand a freed bike to an own-bike waitlister.
--      It now promotes only into a place that is really free, and skips own-bike waitlisters
--      where they take none.
--   G. _approval_guard tested current_user, which inside a SECURITY DEFINER function is always
--      its owner, so it let every write through since 2026-08-14. It now reads the request's
--      role (auth.role()); the SQL editor and service connections still pass.
--   H. ADD-ON STOCK. customer_addon_stock moved any item by ±20 per call, unlimited calls, for
--      anyone with one live booking. Stock now moves only as far as the caller's own bookings
--      account for it: queue_entries.addons_held records what each booking has taken, a
--      booking holds its add-ons while waiting, out or done, and none otherwise.
--   I. customer_create_booking checks every rider before writing any (a bad rider 3 used to
--      leave riders 1 and 2 booked), derives the day and date from the session, and cleans the
--      contact, size, height, registration time and waiver fields instead of storing them raw.
--   J. The rider's cancel reason (20260922130000, applied the same day) is carried over exactly:
--      cancel_reason/cancel_note are kept only on the cancelling write, a malformed code is
--      dropped, never refused, and any later write that sets a status clears them.
--
-- The current client keeps working unchanged: every key it sends is still accepted or quietly
-- ignored (price, queue_num, assigned_bike_id), and the one it now needs (promo_lookup) falls
-- back to the old table read when absent. Functions are rebuilt from their LIVE definitions
-- (pg_get_functiondef, 2026-09-22) with SECURITY DEFINER and search_path restated; CREATE OR
-- REPLACE keeps each existing function's grants as they are. New functions state their own.
-- Rollback: supabase/rollbacks/20260922122000_the_server_prices_and_moves_bookings.sql
-- ============================================================================

-- ── 0. What a booking's add-ons hold ───────────────────────────────────────
alter table public.queue_entries add column if not exists addons_held jsonb not null default '{}'::jsonb;
comment on column public.queue_entries.addons_held is
  'Add-on stock this booking has taken, {item id: qty}. Moved by customer_addon_stock / _promote_next_waitlist, and set to the booking''s add-ons by every staff write (the staff app moves the stock itself).';

-- A booking's add-ons as {item id: qty}, whichever of the two stored shapes it has.
create or replace function public._addon_map(v text)
 returns jsonb
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare j jsonb; x jsonb; m jsonb := '{}'::jsonb; k text; q int;
begin
  if v is null or v = '' then return m; end if;
  begin j := v::jsonb; exception when others then return m; end;
  if jsonb_typeof(j) <> 'array' then return m; end if;
  for x in select * from jsonb_array_elements(j) loop
    if jsonb_typeof(x) = 'string' then k := x #>> '{}'; q := 1;
    elsif jsonb_typeof(x) = 'object' then
      k := x->>'id';
      q := case when (x->>'qty') ~ '^[0-9]{1,3}$' then greatest((x->>'qty')::int, 1) else 1 end;
    else continue;
    end if;
    if coalesce(k, '') = '' then continue; end if;
    m := jsonb_set(m, array[k], to_jsonb(coalesce((m->>k)::int, 0) + q));
  end loop;
  return m;
end $function$;

-- ── 1. Fares ────────────────────────────────────────────────────────────────
-- The fare a booking on this session, of this type, pays before any promo: 0 on a free
-- community ride; the employee fare when the ride's own registration form links it; else the
-- standard fare; an unknown type fails closed on the dearest one; an own bike has none (null).
create or replace function public._fare_now(p_session_id text, p_entry_id text, p_type text)
 returns numeric
 language sql
 stable
 set search_path to 'public'
as $function$
  select case
    when coalesce(s.event_kind, '') = 'community' and not coalesce(s.paid_ride, false) then 0
    else coalesce(_booking_fare(p_entry_id, coalesce(s.ride_kind, ''), p_type),
                  case when coalesce(p_type, '') = 'Own' then null
                       else (select max(price) from ride_prices) end)
  end
  from sessions s where s.id = p_session_id
$function$;
revoke all on function public._fare_now(text, text, text) from public, anon, authenticated;

-- A code's price for one rider: p_canonical is this rider's fare, p_base the booking's
-- total fare that a flat, unrestricted code is shared across. The wizard's arithmetic
-- (_promoDiscount / _applyPromoToEntries), rounded to the halala.
create or replace function public._promo_fare(p_code promo_codes, p_type text, p_canonical numeric, p_base numeric)
 returns numeric
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when p_canonical is null then null
    when p_code.applies_to is not null and p_code.applies_to is distinct from p_type then p_canonical
    when p_code.kind = 'flat' and p_code.applies_to is not null
      then greatest(p_canonical - least(greatest(coalesce(p_code.value, 0), 0), p_canonical), 0)
    when p_code.kind = 'flat'
      then case when coalesce(p_base, 0) <= 0 then p_canonical
                else greatest(round(p_canonical * (p_base - least(greatest(coalesce(p_code.value, 0), 0), p_base)) / p_base, 2), 0) end
    else greatest(round(p_canonical * (1 - least(greatest(coalesce(p_code.value, 0), 0), 100) / 100), 2), 0)
  end
$function$;

CREATE OR REPLACE FUNCTION public._enforce_booking_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       and not (coalesce(old.paid, false) and not coalesce(new.paid, false)) then
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
      _fresh := tg_op = 'INSERT' or lower(coalesce(old.promo_code, '')) <> lower(new.promo_code);
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
end $function$;

-- ── 2. The use count follows the code as well as the status ────────────────
CREATE OR REPLACE FUNCTION public._promo_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _o text; _n text;
begin
  if tg_op = 'INSERT' then
    if new.promo_code is not null and new.promo_code <> '' then
      update promo_codes set uses = coalesce(uses, 0) + 1
       where lower(code) = lower(new.promo_code);
    end if;
    return new;
  end if;

  -- A row holds one use while it is live and carries the code. A cancel, a restore, a code
  -- applied after booking or cleared by the price trigger each move the count to match.
  _o := case when coalesce(old.status,'') not in ('cancelled','removed') then lower(nullif(old.promo_code, '')) end;
  _n := case when coalesce(new.status,'') not in ('cancelled','removed') then lower(nullif(new.promo_code, '')) end;
  if _o is not distinct from _n then return new; end if;
  if _o is not null then
    update promo_codes set uses = greatest(coalesce(uses, 0) - 1, 0) where lower(code) = _o;
  end if;
  if _n is not null then
    update promo_codes set uses = coalesce(uses, 0) + 1 where lower(code) = _n;
  end if;
  return new;
end $function$;

drop trigger if exists trg_promo_count_upd on public.queue_entries;
create trigger trg_promo_count_upd
  after update of status, promo_code on public.queue_entries
  for each row execute function public._promo_count();

-- ── 3. Promo codes are staff's table; the form asks about one code ─────────
drop policy if exists "public read" on public.promo_codes;
drop policy if exists "staff read" on public.promo_codes;
create policy "staff read" on public.promo_codes for select using ((select is_staff()));

create or replace function public.promo_lookup(p_code text, p_id text default null, p_token text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare c promo_codes%rowtype;
        -- Arabic-Indic and Persian digits typed on an Arabic keyboard are the same code (the app
        -- folds them too); letters match whatever their case, as the app always compared them.
        v text := translate(btrim(coalesce(p_code, '')), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
begin
  if v = '' or length(v) > 40 then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  -- Guessing codes one request at a time is metered per network, like the other lookups.
  if not _ip_gate('promo', 60, interval '10 minutes') then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select * into c from promo_codes where lower(code) = lower(v) and active = true order by id limit 1;
  if c.id is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if c.expires_at is not null and c.expires_at < (now() at time zone 'Asia/Riyadh')::date then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if c.max_uses is not null and coalesce(c.uses, 0) >= c.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'used_up');
  end if;
  if c.customer_id is not null and (p_id is null or c.customer_id <> p_id or not _cust_token_ok(p_id, p_token)) then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;
  -- What the form needs to preview the discount; the booking's price is still decided above.
  return jsonb_build_object('ok', true, 'code', c.code, 'kind', c.kind, 'value', c.value, 'applies_to', c.applies_to);
end $function$;
revoke all on function public.promo_lookup(text, text, text) from public;
grant execute on function public.promo_lookup(text, text, text) to anon, authenticated;

-- ── 4. Room, the fill rule and the waitlist ─────────────────────────────────
-- Is there a place for one more rider of this type, by _capacity_guard's count? A session
-- marked Full has none. The session row is locked first, then the capacity lock, the order a
-- new booking takes them in (assign_queue_num, then _capacity_guard).
create or replace function public._session_has_room(p_session_id text, p_type text, p_exclude text)
 returns boolean
 language plpgsql
 set search_path to 'public'
as $function$
declare s sessions%rowtype; _own boolean; _live int;
begin
  select * into s from sessions where id = p_session_id for update;
  if not found or coalesce(s.status, '') = 'full' then return false; end if;
  if coalesce(s.needs_approval, false) then return true; end if;   -- staff pick those riders by hand
  _own := coalesce(s.event_kind, '') = 'community' and coalesce(s.ride_kind, '') = 'petromin';
  if coalesce(p_type, '') = 'Own' and not _own then return true; end if;   -- an own bike takes no place
  perform pg_advisory_xact_lock(hashtext('cap:' || p_session_id));
  select count(*) into _live from queue_entries q
   where q.session_id = p_session_id and q.id is distinct from p_exclude
     and coalesce(q.status, '') not in ('cancelled', 'removed', 'noshow')
     and (_own or coalesce(q.type_preference, '') <> 'Own');
  return _live < coalesce(s.capacity, 12);
end $function$;
revoke all on function public._session_has_room(text, text, text) from public, anon, authenticated;

-- The fill rule for one session: the body _session_fill_status always had.
create or replace function public._session_fill_recount(p_session_id text)
 returns void
 language plpgsql
 set search_path to 'public'
as $function$
declare _cap int; _live int; _appr boolean; _st text; _petro boolean; _auto boolean;
begin
  if p_session_id is null then return; end if;
  select coalesce(s.capacity,12), coalesce(s.needs_approval,false), coalesce(s.status,''),
         (coalesce(s.event_kind,'') = 'community' and coalesce(s.ride_kind,'') = 'petromin'),
         coalesce(s.auto_full,false)
    into _cap, _appr, _st, _petro, _auto
    from sessions s where s.id = p_session_id;
  -- No such session, an approval ride, or a status this rule does not own.
  if not found or _appr or _st not in ('open','full') then return; end if;
  select count(*) into _live
    from queue_entries q
   where q.session_id = p_session_id
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and (_petro or coalesce(q.type_preference,'') <> 'Own');
  if _live >= _cap and _st <> 'full' then
    update sessions set status = 'full', auto_full = true where id = p_session_id;
  elsif _live < _cap and _st = 'full' and _auto then
    update sessions set status = 'open', auto_full = false where id = p_session_id;
  end if;
end $function$;
revoke all on function public._session_fill_recount(text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._session_fill_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- A booking that moved changed two counts: the night it left can reopen, too.
  if tg_op = 'UPDATE' and new.session_id is distinct from old.session_id then
    perform _session_fill_recount(old.session_id);
  end if;
  perform _session_fill_recount(coalesce(new.session_id, old.session_id));
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public._promote_next_waitlist(p_session_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    for k in select jsonb_object_keys(_a) loop
      update inventory i set qty = i.qty - (_a->>k)::int where i.id = k;
    end loop;
    update queue_entries set addons_held = _a where id = _row.id;
  exception when others then null;
  end;

  return _row.id;
end $function$;
revoke all on function public._promote_next_waitlist(text) from public, anon, authenticated;

-- A move keeps nothing of its old waitlist place: the number is issued again in the new session.
drop trigger if exists wl_num_assign_upd on public.queue_entries;
create trigger wl_num_assign_upd
  before update on public.queue_entries
  for each row
  when (new.status = 'waitlist' and (old.status is distinct from new.status
        or new.waitlist_num is null or new.session_id is distinct from old.session_id))
  execute function public._wl_num_assign();

-- ── 5. Approval is staff's, for real ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._approval_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    if new.approval is distinct from old.approval and not is_staff() then
      new.approval := old.approval;
    end if;
  end if;
  return new;
end $function$;

-- ── 6. Add-on stock follows the bookings ────────────────────────────────────
-- A staff write moves stock in the app itself (_invApplyDelta) for whatever state it leaves
-- the row in, so the record follows the row: a live row holds its add-ons, any other none.
create or replace function public._addons_held_sync()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not (select is_staff()) then return new; end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.addons is distinct from old.addons then
    new.addons_held := case when coalesce(new.status, '') in ('waiting','active','done')
                            then _addon_map(new.addons) else '{}'::jsonb end;
  end if;
  return new;
end $function$;
revoke all on function public._addons_held_sync() from public, anon, authenticated;
drop trigger if exists queue_entries_addons_held on public.queue_entries;
create trigger queue_entries_addons_held
  before insert or update of status, addons on public.queue_entries
  for each row execute function public._addons_held_sync();

CREATE OR REPLACE FUNCTION public.customer_addon_stock(p_id text, p_token text, p_items jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare it jsonb; d int; n int; _id text; _left int; _mv int; _moved int; r record; _tgt int; _held int;
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return false; end if;
  n := jsonb_array_length(p_items);
  -- A booking carries a handful of add-ons; anything past this is not a booking.
  if n > 20 then return false; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    _id := it->>'id';
    d := case when (it->>'delta') ~ '^-?[0-9]{1,3}$' then (it->>'delta')::int else 0 end;
    if coalesce(_id, '') = '' or d = 0 or d < -20 or d > 20 then continue; end if;
    _left := abs(d); _moved := 0;
    -- Stock moves only as far as the caller's own bookings account for it: taking needs a
    -- booking that holds fewer of the item than it carries, giving back one that holds more
    -- than it still should (cancelled, waitlisted, or the add-on removed).
    for r in select x.id, x.status, _addon_map(x.addons) as a, coalesce(x.addons_held, '{}'::jsonb) as h
               from queue_entries x
              where x.customer_id = p_id
                and (coalesce(x.addons, '') <> '' or coalesce(x.addons_held, '{}'::jsonb) <> '{}'::jsonb)
              order by x.registered_at desc, x.id
              for update of x loop
      exit when _left = 0;
      _tgt := case when coalesce(r.status, '') in ('waiting','active','done') then coalesce((r.a->>_id)::int, 0) else 0 end;
      _held := coalesce((r.h->>_id)::int, 0);
      _mv := case when d < 0 then least(_left, greatest(_tgt - _held, 0))
                  else least(_left, greatest(_held - _tgt, 0)) end;
      if _mv > 0 then
        _held := _held + case when d < 0 then _mv else -_mv end;
        update queue_entries x2
           set addons_held = case when _held > 0 then jsonb_set(coalesce(x2.addons_held, '{}'::jsonb), array[_id], to_jsonb(_held))
                                  else coalesce(x2.addons_held, '{}'::jsonb) - _id end
         where x2.id = r.id;
        _left := _left - _mv; _moved := _moved + _mv;
      end if;
    end loop;
    if _moved > 0 then
      update inventory
         set qty = coalesce(qty,0) + case when d < 0 then -_moved else _moved end,   -- may go negative: a backorder owed to a booking
             updated_at = to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')
       where inventory.id = _id;
    end if;
  end loop;
  return true;
end $function$;

-- What each live booking has already taken. Every waiting, out or finished booking took its
-- add-ons when it was confirmed (the app's rule); a waitlisted or cancelled one holds none.
-- 30 rows on 2026-09-22; none of them is touched by any other trigger rule on this update.
update public.queue_entries
   set addons_held = public._addon_map(addons)
 where coalesce(addons, '') not in ('', '[]')
   and coalesce(status, '') in ('waiting', 'active', 'done')
   and addons_held = '{}'::jsonb;

-- ── 7. Creating a booking ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customer_create_booking(p_id text, p_token text, p_entries jsonb)
 RETURNS TABLE(id text, queue_num integer, status text, waitlist_num integer, price numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  select * into s from sessions where sessions.id = _sid and coalesce(sessions.status,'') in ('open','full');
  -- Closed, deleted, or gone while the rider sat on the confirm step.
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
end $function$;

-- ── 8. What a customer may change on their own booking ─────────────────────
CREATE OR REPLACE FUNCTION public.customer_booking_update(p_id text, p_token text, p_entry_id text, p_patch jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  q queue_entries%rowtype; _to sessions%rowtype; _at sessions%rowtype; _p jsonb; _today text;
  _want text; _new_status text; _move boolean := false; _qnum int; _live int;
  _type text; _size text; _h int; _name text; _addons text; _set_addons boolean := false;
  _code text; _unpay boolean := false; _rb int; _re int; _cancelling boolean;
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  _p := coalesce(p_patch, '{}'::jsonb);
  if jsonb_typeof(_p) <> 'object' then return false; end if;
  select * into q from queue_entries x where x.id = p_entry_id and x.customer_id = p_id for update;
  if not found then return false; end if;
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
    -- An on-the-house row whose new bike the perk no longer covers goes back to paying (the
    -- Edit booking rule); nothing else a customer sends can mark a row unpaid.
    if coalesce(_p->>'paid','') = 'false' and q.paid and coalesce(q.price,0) = 0 and coalesce(q.promo_code,'') = ''
       and _type is not null and _type is distinct from q.type_preference then
      _unpay := true;
    end if;
  end if;
  if _p ? 'addons' and q.status in ('waiting','waitlist','active') and coalesce(_new_status,'') <> 'cancelled' then
    _addons := nullif(_p->>'addons','');
    _set_addons := _addons is null or _addons_ok(_addons);
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

  update queue_entries x set
    type_preference  = coalesce(_type, x.type_preference),
    size             = coalesce(_size, x.size),
    height           = coalesce(_h, x.height),
    name             = coalesce(_name, x.name),
    paid             = case when _unpay then false else x.paid end,
    status           = coalesce(_new_status, x.status),
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
  if q.status = 'waiting' and (_new_status = 'cancelled' or _move) then
    perform _promote_next_waitlist(q.session_id);
  end if;

  return true;
end $function$;
