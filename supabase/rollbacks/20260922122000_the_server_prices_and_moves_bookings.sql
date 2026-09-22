-- Rollback of 20260922122000_the_server_prices_and_moves_bookings.sql (run after the 123000
-- rollback and before the 121000 one).
-- Every function below is its live definition of 2026-09-22 (pg_get_functiondef), re-read after
-- 20260922130000 cancel_reason changed customer_booking_update the same day. The
-- addons_held record is dropped with its column; stock itself is not touched. Idempotent.

CREATE OR REPLACE FUNCTION public._enforce_booking_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- An employee from the ride's own registration form rides at the employee fare;
    -- everyone else, website bookings included, at the standard fare.
    canonical := _booking_fare(new.id, _ride_kind, new.type_preference);

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

CREATE OR REPLACE FUNCTION public._promo_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.promo_code is not null and new.promo_code <> '' then
      update promo_codes set uses = coalesce(uses, 0) + 1
       where lower(code) = lower(new.promo_code);
    end if;
    return new;
  end if;

  if coalesce(old.status,'') not in ('cancelled','removed')
     and coalesce(new.status,'') in ('cancelled','removed')
     and new.promo_code is not null and new.promo_code <> '' then
    update promo_codes set uses = greatest(coalesce(uses, 0) - 1, 0)
     where lower(code) = lower(new.promo_code);
  elsif coalesce(old.status,'') in ('cancelled','removed')
     and coalesce(new.status,'') not in ('cancelled','removed')
     and new.promo_code is not null and new.promo_code <> '' then
    update promo_codes set uses = coalesce(uses, 0) + 1
     where lower(code) = lower(new.promo_code);
  end if;
  return new;
end $function$;

drop trigger if exists trg_promo_count_upd on public.queue_entries;
create trigger trg_promo_count_upd
  after update of status on public.queue_entries
  for each row execute function public._promo_count();

drop policy if exists "staff read" on public.promo_codes;
drop policy if exists "public read" on public.promo_codes;
create policy "public read" on public.promo_codes for select using (true);

CREATE OR REPLACE FUNCTION public._session_fill_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  if not found or _appr or _st not in ('open','full') then return null; end if;

  select count(*) into _live
    from queue_entries q
   where q.session_id = _sid
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and (_petro or coalesce(q.type_preference,'') <> 'Own');

  if _live >= _cap and _st <> 'full' then
    update sessions set status = 'full', auto_full = true where id = _sid;
  elsif _live < _cap and _st = 'full' and _auto then
    update sessions set status = 'open', auto_full = false where id = _sid;
  end if;

  return null;
end $function$;

CREATE OR REPLACE FUNCTION public._promote_next_waitlist(p_session_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

drop trigger if exists wl_num_assign_upd on public.queue_entries;
create trigger wl_num_assign_upd
  before update on public.queue_entries
  for each row
  when (new.status = 'waitlist' and old.status is distinct from new.status)
  execute function public._wl_num_assign();

CREATE OR REPLACE FUNCTION public._approval_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if current_user not in ('anon','authenticated') then return new; end if;
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

CREATE OR REPLACE FUNCTION public.customer_addon_stock(p_id text, p_token text, p_items jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare it jsonb; d int; n int;
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  if not exists(select 1 from queue_entries q
                 where q.customer_id = p_id
                   and coalesce(q.status,'') in ('waiting','waitlist','active')) then
    return false;
  end if;
  n := jsonb_array_length(coalesce(p_items, '[]'::jsonb));
  if n > 20 then return false; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    d := coalesce((it->>'delta')::int, 0);
    if d < -20 or d > 20 then continue; end if;
    update inventory
       set qty = coalesce(qty,0) + d,
           updated_at = to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')
     where id = it->>'id';
  end loop;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.customer_create_booking(p_id text, p_token text, p_entries jsonb)
 RETURNS TABLE(id text, queue_num integer, status text, waitlist_num integer, price numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  it jsonb; cust customers%rowtype; _first boolean := true;
  _appr boolean; _house text; _paid boolean; _price numeric;
  _sid text; _sstatus text; _status text; _wv text;
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
  -- check-up - come before any booking (20260921180000). The app raises the same request at
  -- the event pick and at Confirm; this is the backstop for a client that does not.
  if cardinality(coalesce(_customer_asks(p_id), '{}'::text[])) > 0 then
    raise exception 'FIX_FIRST' using errcode = 'P0001';
  end if;

  -- A malformed batch is a client bug, not a rider-facing state: still empty.
  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) = 0 or jsonb_array_length(p_entries) > 10 then
    return;
  end if;

  _sid := p_entries->0->>'session_id';
  select coalesce(s.needs_approval,false), coalesce(s.status,'') into _appr, _sstatus from sessions s
   where s.id = _sid and coalesce(s.status,'') in ('open','full');
  -- Closed, deleted, or gone while the rider sat on the confirm step.
  if not found then
    raise exception 'SESSION_CLOSED' using errcode = 'P0001';
  end if;

  _status := case when _sstatus = 'full' then 'waitlist' else 'waiting' end;

  if coalesce(cust.default_pay,'') like 'house%' then
    _house := case when cust.default_pay = 'house' then 'all'
                   else substring(cust.default_pay from 7) end;
  end if;

  for it in select * from jsonb_array_elements(p_entries) loop
    if it->>'session_id' is distinct from _sid then return; end if;

    _paid := false;
    _price := nullif(it->>'price','')::numeric;
    if _first and _house is not null
       and lower(btrim(coalesce(it->>'name',''))) = lower(btrim(coalesce(cust.name,'')))
       and (_house = 'all' or coalesce(it->>'type_preference','Any') = any(string_to_array(_house, ',')))
    then
      _paid := true;
      _price := 0;
    end if;
    _first := false;

    -- The version is the client's (only it knows which text it rendered); the TIME is ours.
    _wv := left(nullif(it->>'waiver_version',''), 40);

    return query
    insert into queue_entries (
      id, name, size, height, type_preference, session_id, session_day, session_date,
      queue_num, registered_at, phone, email, status, paid, price, promo_code,
      customer_id, walk_in, group_id, approval, assigned_bike_id,
      waiver_at, waiver_version
    ) values (
      coalesce(nullif(it->>'id',''), encode(gen_random_bytes(12),'hex')),
      left(coalesce(it->>'name',''), 60),
      coalesce(it->>'size',''),
      nullif(it->>'height','')::int,
      coalesce(it->>'type_preference','Any'),
      _sid,
      it->>'session_day',
      it->>'session_date',
      coalesce(nullif(it->>'queue_num','')::int, 0),
      coalesce(nullif(it->>'registered_at',''), now()::text),
      left(coalesce(it->>'phone', coalesce(cust.phone,'')), 30),
      left(coalesce(it->>'email', coalesce(cust.email,'')), 120),
      _status,
      _paid,
      _price,
      nullif(it->>'promo_code',''),
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
  end loop;
end $function$;

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

drop trigger if exists queue_entries_addons_held on public.queue_entries;
drop function if exists public._addons_held_sync();
drop function if exists public.promo_lookup(text, text, text);
drop function if exists public._session_has_room(text, text, text);
drop function if exists public._session_fill_recount(text);
drop function if exists public._promo_fare(promo_codes, text, numeric, numeric);
drop function if exists public._fare_now(text, text, text);
drop function if exists public._addon_map(text);
alter table public.queue_entries drop column if exists addons_held;
