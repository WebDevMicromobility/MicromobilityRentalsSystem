-- The booking RPC that finally lets queue_entries stop being world-readable. 2026-08-16.
--
-- Why this exists: the customer booking form does `.insert(...).select()`. RETURNING applies
-- SELECT policies to the new row, so dropping `public read` broke booking outright (a live
-- outage on 2026-08-16) and the policy had to be restored. The client genuinely needs the
-- row back — the DB assigns the queue number atomically and may coerce 'waiting' into
-- 'waitlist' when two devices race for the last spot.
--
-- A SECURITY DEFINER function returns the row without the caller needing SELECT at all, so
-- once both call sites use it, `public read` can go.
--
-- It also closes a second hole that direct inserts leave open. Today a customer can POST a
-- booking with paid=true and any price they like: the price trigger clamps `price`, but
-- nothing checks `paid`, so a rider could book themselves a free ride that reads as settled
-- in the close-out. Here, paid/price are DERIVED from the customer's own default_pay, never
-- accepted from the request. Same for customer_id — it comes from the verified token.

create or replace function public.customer_create_booking(
  p_id text, p_token text, p_entries jsonb
) returns table (
  id text, queue_num integer, status text, waitlist_num integer, price numeric
)
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  it        jsonb;
  cust      customers%rowtype;
  _first    boolean := true;
  _kind     text;
  _house    text;
  _paid     boolean;
  _price    numeric;
  _sid      text;
  _sstatus  text;
  _status   text;
begin
  if not _cust_token_ok(p_id, p_token) then return; end if;
  select * into cust from customers where customers.id = p_id;
  if not found then return; end if;

  -- A booking is a handful of riders, never a flood.
  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) = 0 or jsonb_array_length(p_entries) > 10 then
    return;
  end if;

  -- Every row must target the same session, and it must be one that is actually taking
  -- bookings. Without this the RPC would be a way to write into a closed session.
  _sid := p_entries->0->>'session_id';
  select coalesce(s.event_kind,''), coalesce(s.status,'') into _kind, _sstatus from sessions s
   where s.id = _sid and coalesce(s.status,'') in ('open','full');
  if not found then return; end if;

  -- Status is decided here, not by the caller. _capacity_guard coerces 'waiting' to
  -- 'waitlist' once the session is full BY COUNT, but it cannot see a session staff have
  -- marked full by hand — so that case is handled explicitly. Letting the client choose
  -- would let a rider post status='waiting' into a session that is closed to new riders.
  _status := case when _sstatus = 'full' then 'waitlist' else 'waiting' end;

  -- The house perk, read from the customer's own record rather than the request.
  -- default_pay is either 'house' (every type) or 'house:Road,Hybrid' (a list).
  if coalesce(cust.default_pay,'') like 'house%' then
    _house := case when cust.default_pay = 'house' then 'all'
                   else substring(cust.default_pay from 7) end;
  end if;

  for it in select * from jsonb_array_elements(p_entries) loop
    if it->>'session_id' is distinct from _sid then return; end if;  -- one session per call

    -- Free ride only for the FIRST rider, only when the account holder is riding under
    -- their own name, and only for a covered type. Co-riders always pay. This mirrors
    -- _applyDefaultPay in the client, but the client's copy is now only a price preview.
    -- price IS taken from the request, deliberately: a promo discount is computed client-side
    -- and spread across the riders, and _enforce_booking_price is what makes that safe — it
    -- re-derives the canonical fare unless _promo_valid accepts the code, and clamps to the
    -- canonical fare either way. Sending null here would hand every promo booking full price.
    -- `paid` gets no such protection from any trigger, which is why it is derived below.
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

    return query
    insert into queue_entries (
      id, name, size, height, type_preference, session_id, session_day, session_date,
      queue_num, registered_at, phone, email, status, paid, price, promo_code,
      customer_id, walk_in, group_id, approval, assigned_bike_id
    ) values (
      coalesce(nullif(it->>'id',''), encode(gen_random_bytes(12),'hex')),
      left(coalesce(it->>'name',''), 60),
      coalesce(it->>'size',''),
      nullif(it->>'height','')::int,
      coalesce(it->>'type_preference','Any'),
      _sid,
      it->>'session_day',
      it->>'session_date',
      -- 0 is a placeholder; queue_entries_assign_qnum overwrites it atomically.
      coalesce(nullif(it->>'queue_num','')::int, 0),
      coalesce(nullif(it->>'registered_at',''), now()::text),
      left(coalesce(it->>'phone', coalesce(cust.phone,'')), 30),
      left(coalesce(it->>'email', coalesce(cust.email,'')), 120),
      _status,                        -- server-decided; _capacity_guard may still coerce it
      _paid,                          -- derived, never taken from the request
      _price,                         -- clamped (and re-derived) by _enforce_booking_price
      nullif(it->>'promo_code',''),   -- validity is enforced by _promo_valid in the trigger
      p_id,                           -- the token's owner, not whatever was sent
      false,
      nullif(it->>'group_id',''),
      case when _kind = 'community' then 'pending' else null end,
      null                            -- customers never assign themselves a bike
    )
    returning queue_entries.id, queue_entries.queue_num, queue_entries.status,
              queue_entries.waitlist_num, queue_entries.price;
  end loop;
end $function$;

grant execute on function public.customer_create_booking(text,text,jsonb) to anon, authenticated;

comment on function public.customer_create_booking(text,text,jsonb) is
  'Customer booking insert that returns the created rows without needing SELECT on queue_entries. Derives customer_id, paid and price server-side. Once both client call sites use it, the "public read" and "public insert booking" policies can be dropped.';
