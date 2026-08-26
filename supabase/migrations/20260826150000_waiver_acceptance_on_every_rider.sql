-- ─────────────────────────────────────────────────────────────────────────────
-- Waiver acceptance, recorded per rider.
--
-- Two columns, not one. A bare timestamp says somebody agreed to SOMETHING at a
-- moment in time; the first reword of the waiver text makes every prior row
-- unanswerable. waiver_version pins which wording it was (the client sends
-- WAIVER_VERSION, bumped with any edit to waiverBody).
--
-- Stamped on EVERY rider row in the booking, not just the first. One person taps
-- the box for a party of up to ten, and the copy they accept says so in as many
-- words — "I have read the waiver and agree on behalf of every rider on this
-- booking" — so each row carries its own record of that.
--
-- waiver_at is set by the SERVER, from now(), and is never taken from the
-- client: a timestamp a caller can choose is not evidence of anything. The
-- version is client-supplied, because only the client knows which text it
-- rendered; it is a record, not a security boundary.
--
-- KNOWN GAP, deliberately: a walk-in booked at the desk never passes through the
-- wizard and so carries no waiver. Coverage is customer-side only. Do not treat
-- these columns as blanket cover for everyone who rode.
--
-- Rollback:
--   alter table public.queue_entries drop column if exists waiver_at,
--                                     drop column if exists waiver_version;
--   (and re-apply the previous customer_create_booking from git history)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.queue_entries
  add column if not exists waiver_at      text,
  add column if not exists waiver_version text;

comment on column public.queue_entries.waiver_at is
  'UTC ISO-8601. Set server-side by customer_create_booking when the booking carried a waiver version. Null on walk-ins and on every booking made before 2026-08-26.';
comment on column public.queue_entries.waiver_version is
  'Which wording of the ride waiver was accepted, e.g. 2026-08-v1. Client-supplied.';

-- The booking RPC stamps both columns on every row it inserts. Unchanged otherwise:
-- the token check, the batch bounds, the "on the house" rule, the field truncation and
-- the waiting/waitlist decision are all exactly as they were.
CREATE OR REPLACE FUNCTION public.customer_create_booking(p_id text, p_token text, p_entries jsonb)
 RETURNS TABLE(id text, queue_num integer, status text, waitlist_num integer, price numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
declare
  it jsonb; cust customers%rowtype; _first boolean := true;
  _appr boolean; _house text; _paid boolean; _price numeric;
  _sid text; _sstatus text; _status text; _wv text;
begin
  if not _cust_token_ok(p_id, p_token) then return; end if;
  select * into cust from customers where customers.id = p_id;
  if not found then return; end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) = 0 or jsonb_array_length(p_entries) > 10 then
    return;
  end if;

  _sid := p_entries->0->>'session_id';
  select coalesce(s.needs_approval,false), coalesce(s.status,'') into _appr, _sstatus from sessions s
   where s.id = _sid and coalesce(s.status,'') in ('open','full');
  if not found then return; end if;

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
    -- A timestamp the caller can choose is not evidence of anything.
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
