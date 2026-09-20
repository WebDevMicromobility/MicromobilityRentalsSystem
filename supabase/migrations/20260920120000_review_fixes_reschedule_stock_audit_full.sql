-- ============================================================================
-- Review fixes, 2026-09-20. Six things, all found by reading the code against
-- the live database. NOT YET APPLIED — run this in the SQL editor, then:
--   supabase migration repair --status applied 20260920120000
-- Afterwards supabase/checks/security-attributes.sql must still print nothing.
-- ============================================================================

-- ── 1. Customers can move their own booking to another night ────────────────
-- My Bookings has had a Reschedule button all along, but it wrote straight to
-- queue_entries, whose only UPDATE policy is is_staff(). A customer's write matched no
-- policy, changed zero rows and returned NO error, so the app toasted "Rescheduled" over a
-- booking that never moved and the rider was no-showed on the original night.
-- customer_booking_update now accepts the three session columns, validated here rather than
-- trusted from the client: the target must exist, be open or full, not be an approval ride
-- (those are invite-only and never a reschedule target) and not be in the past.
create or replace function public.customer_booking_update(p_id text, p_token text, p_entry_id text, p_patch jsonb)
 returns boolean language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare _old_status text; _sess text; _to sessions%rowtype; _today text;
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
    -- The move itself. session_day/date follow the row we just validated, never the client's.
    session_id       = case when p_patch ? 'session_id' then _to.id       else q.session_id   end,
    session_day      = case when p_patch ? 'session_id' then _to.day      else q.session_day  end,
    session_date     = case when p_patch ? 'session_id' then coalesce(_to.session_date, _to.id) else q.session_date end,
    rating_bike      = case when p_patch ? 'rating_bike' then nullif(p_patch->>'rating_bike','')::int else q.rating_bike end,
    rating_exp       = case when p_patch ? 'rating_exp'  then nullif(p_patch->>'rating_exp','')::int  else q.rating_exp end,
    feedback         = case when p_patch ? 'feedback'    then p_patch->>'feedback'                    else q.feedback end,
    addons           = case when p_patch ? 'addons'      then p_patch->>'addons'                      else q.addons end,
    assigned_bike_id = case when p_patch ? 'assigned_bike_id' then null                              else q.assigned_bike_id end,
    cancelled_by     = case when coalesce(p_patch->>'status','') = 'cancelled' then 'customer' else q.cancelled_by end
  where q.id = p_entry_id;

  -- A move frees a place on the night being left, exactly as a cancellation does.
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
revoke all on function public.customer_booking_update(text,text,text,jsonb) from public;
grant execute on function public.customer_booking_update(text,text,text,jsonb) to anon, authenticated;

-- ── 2. Add-on stock is no longer an open write on the whole inventory ───────
-- The only guard was "the caller is A customer". Nothing bounded how many items one call
-- could carry and nothing tied them to the caller, so any registered customer could send a
-- thousand entries in one request and drive every product's qty far negative.
create or replace function public.customer_addon_stock(p_id text, p_token text, p_items jsonb)
 returns boolean language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare it jsonb; d int; n int;
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  -- A booking is what add-ons belong to. No live booking, no reason to move stock at all.
  if not exists(select 1 from queue_entries q
                 where q.customer_id = p_id
                   and coalesce(q.status,'') in ('waiting','waitlist','active')) then
    return false;
  end if;
  n := jsonb_array_length(coalesce(p_items, '[]'::jsonb));
  -- A booking carries a handful of add-ons; anything past this is not a booking.
  if n > 20 then return false; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    d := coalesce((it->>'delta')::int, 0);
    if d < -20 or d > 20 then continue; end if;
    update inventory
       set qty = coalesce(qty,0) + d,   -- may go negative: a backorder owed to a booking
           updated_at = to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')
     where id = it->>'id';
  end loop;
  return true;
end $function$;
revoke all on function public.customer_addon_stock(text,text,jsonb) from public;
grant execute on function public.customer_addon_stock(text,text,jsonb) to anon, authenticated;

-- ── 3. The audit trail is written by staff, like everything else ────────────
-- Every other staff table requires an authenticated staff session to write. staff_actions
-- took an INSERT from anyone holding the public anon key, so the shared audit trail could be
-- forged or flooded by any visitor. Staff sign in with Supabase auth, so is_staff() holds for
-- every legitimate writer.
drop policy if exists "audit insert" on public.staff_actions;
create policy "audit insert" on public.staff_actions
  for insert with check ((select is_staff()));

-- ── 4. A function nothing calls, that could renumber anybody's night ────────
-- customer_shiftdown checked only that the caller was a customer: nothing tied them to the
-- session or the number they passed, so any account could renumber every waiting booking on
-- any session and invalidate the numbers already printed on tickets and Wallet passes. The
-- client made renumbering a deliberate no-op long ago and never calls it.
revoke all on function public.customer_shiftdown(text,text,text,integer) from anon, authenticated, public;

-- ── 5. A bike type with no price skipped the price check entirely, and a ──
-- ──    refused promo code still burned one of its uses ─────────────────────
-- ride_prices had no row for 'Kids', which the customer picker offers. With no canonical
-- price _enforce_booking_price fell to its else branch: it never re-derived the fare and
-- never consulted _promo_valid, so the price the client sent stood as-is, zero included —
-- the exact bypass the trigger exists to stop. Seed the missing row, and make an unknown
-- type fail closed on the highest fare rather than trusting the client.
insert into ride_prices(type, price) values ('Kids', 57.5)
  on conflict (type) do nothing;

create or replace function public._enforce_booking_price()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare canonical numeric; _kind text; _paid boolean;
begin
  select coalesce(s.event_kind,''), coalesce(s.paid_ride,false)
    into _kind, _paid
    from sessions s where s.id = new.session_id;

  if _kind = 'community' and not _paid then
    new.price := 0;
    return new;
  end if;

  if tg_op = 'UPDATE' and (select is_staff()) then return new; end if;

  if new.assigned_bike_id is null
     and coalesce(new.paid, false) = false
     and coalesce(new.status, 'waiting') in ('waiting', 'waitlist') then
    select price into canonical from ride_prices where type = new.type_preference;
    -- 'Own' is the one type that legitimately has no fare. Any OTHER unknown type is a gap in
    -- this table, and a gap must not become a free pass: fall back to the dearest fare so a
    -- crafted request is refused by the wallet, not by nobody.
    if canonical is null and coalesce(new.type_preference,'') <> 'Own' then
      select max(price) into canonical from ride_prices;
    end if;
    if canonical is not null then
      if new.promo_code is not null and new.promo_code <> ''
         and _promo_valid(new.promo_code, new.customer_id) then
        new.price := least(greatest(coalesce(new.price, canonical), 0), canonical);
      else
        -- A code that was NOT honoured is not a code this booking carries. Leaving it on the
        -- row let the AFTER trigger _promo_count burn a use for a discount nobody received:
        -- a two-rider booking on a one-use code charged rider two the full fare and still
        -- counted them, so the admin table read "2/1" and the next customer was turned away
        -- by a cap that two riders had spent on one discount. Clearing it here, in the BEFORE
        -- trigger, means the counter only ever sees codes that actually applied.
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

-- ── 6. A staff "Mark Full" sticks ──────────────────────────────────────────
-- The fill rule moves a session between open and full as bookings come and go, and it could
-- not tell its own 'full' from one a person set. So Mark Full on an under-capacity night —
-- the way staff say "only eight bikes are roadworthy tonight" — was undone by the very next
-- check-in, pay toggle or cancellation, and riders nine to twelve booked as confirmed.
-- The rule now marks what it did, and only ever reopens what it filled itself.
alter table public.sessions add column if not exists auto_full boolean not null default false;

CREATE OR REPLACE FUNCTION public._session_fill_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _sid text; _cap int; _live int; _appr boolean; _st text; _petro boolean; _auto boolean;
begin
  _sid := coalesce(new.session_id, old.session_id);
  if _sid is null then return null; end if;

  select coalesce(s.capacity,12), coalesce(s.needs_approval,false), coalesce(s.status,''),
         (coalesce(s.event_kind,'') = 'community' and coalesce(s.ride_kind,'') = 'petromin'),
         coalesce(s.auto_full,false)
    into _cap, _appr, _st, _petro, _auto
    from sessions s where s.id = _sid;

  -- No such session, an approval ride, or a status this rule does not own. 'open' and 'full'
  -- are the two it moves between; 'closed', 'deleted' and anything added later are a
  -- person's decision, and writing over one of those un-deletes a night nobody asked for.
  if not found or _appr or _st not in ('open','full') then return null; end if;

  -- Exactly _capacity_guard's count: waitlist rows included, own-bike riders too on the
  -- Petromin ride.
  select count(*) into _live
    from queue_entries q
   where q.session_id = _sid
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and (_petro or coalesce(q.type_preference,'') <> 'Own');

  if _live >= _cap and _st <> 'full' then
    update sessions set status = 'full', auto_full = true where id = _sid;
  elsif _live < _cap and _st = 'full' and _auto then
    -- Only a full THIS RULE set is reopened. A staff-set full stands until staff change it.
    update sessions set status = 'open', auto_full = false where id = _sid;
  end if;

  return null;
end $function$;

-- Any session sitting at 'full' right now was set by the old rule, which had no marker.
-- Treat one that is at or over capacity as the rule's, and one below it as a person's.
update sessions s
   set auto_full = (
     select count(*) >= coalesce(s.capacity,12)
       from queue_entries q
      where q.session_id = s.id
        and coalesce(q.status,'') not in ('cancelled','removed','noshow')
        and ((coalesce(s.event_kind,'') = 'community' and coalesce(s.ride_kind,'') = 'petromin')
             or coalesce(q.type_preference,'') <> 'Own'))
 where coalesce(s.status,'') = 'full';

-- A status a PERSON writes clears the marker, so the next Mark Full sticks and the next
-- Open hands the night back to the rule. Done here rather than in the client so the client
-- never has to know the column exists, and so it holds for every device and every tool.
-- The fill rule always writes auto_full together with status, and only when status actually
-- changes, so its own writes are the ones where auto_full differs and are left alone.
CREATE OR REPLACE FUNCTION public._session_status_by_hand()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
begin
  if new.status is distinct from old.status
     and new.auto_full is not distinct from old.auto_full then
    new.auto_full := false;
  end if;
  return new;
end $function$;

drop trigger if exists sessions_status_by_hand on public.sessions;
create trigger sessions_status_by_hand
  before update of status on public.sessions
  for each row execute function public._session_status_by_hand();

-- ── 7. A push subscription cannot be taken over by knowing its endpoint ────
-- push_subscribe upserted on endpoint alone and reassigned customer_id to the caller, so a
-- customer who learned another's endpoint took ownership of their subscription row. Push is
-- dormant (VAPID was declined), so this is closing a door on an unused room, cheaply.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'push_subscribe') then
    execute $fn$
      create or replace function public.push_subscribe(p_id text, p_token text, p_endpoint text, p_keys jsonb)
       returns boolean language plpgsql security definer set search_path to 'public', 'extensions'
      as $body$
      begin
        if not _cust_token_ok(p_id, p_token) then return false; end if;
        -- Someone else's endpoint is someone else's row: refuse rather than reassign.
        if exists(select 1 from push_subscriptions
                   where endpoint = p_endpoint and customer_id is distinct from p_id) then
          return false;
        end if;
        insert into push_subscriptions(customer_id, endpoint, keys)
        values (p_id, p_endpoint, p_keys)
        on conflict (endpoint) do update
          set keys = excluded.keys, customer_id = excluded.customer_id
        where push_subscriptions.customer_id = p_id;
        return true;
      end $body$;
    $fn$;
  end if;
end $$;
