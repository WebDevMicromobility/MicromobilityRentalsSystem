-- ============================================================================
-- Three follow-ups (2026-09-21):
--
--  1. Every Apple hidden-email account is asked for its real email at its next event pick,
--     new sign-ups included: the two-completed-rides grace of 20260921170000 is gone.
--     _customer_asks is otherwise unchanged.
--  2. customer_create_booking refuses a rider who still owes details (FIX_FIRST): fields staff
--     asked them to correct, or the Apple check-up. The app shows the same request at the event
--     pick and at Confirm; this backstops an old cached client or a direct call. Staff bookings
--     insert directly and are not affected. Body otherwise identical to production.
--  3. _staff_ref_broadcast carries apple_email, so a new Apple sign-up's relay address reaches
--     the other staff devices at once instead of at the next full reload.
--
-- Headers of customer_create_booking and _staff_ref_broadcast are copied from production
-- (2026-09-21), not from prosrc - see supabase/checks/security-attributes.sql.
--
-- Rollback: re-run 20260921170000 for _customer_asks; drop the FIX_FIRST block from
-- customer_create_booking; drop 'apple_email' from _staff_ref_broadcast's cust_cols.
-- Idempotent: safe to re-run.
-- ============================================================================

create or replace function public._customer_asks(p_id text)
returns text[] language plpgsql stable security definer set search_path = public, extensions as $$
declare c customers%rowtype; f text[]; relay boolean;
begin
  select * into c from customers where customers.id = p_id;
  if not found then return null; end if;
  f := coalesce(c.fix_fields,'{}'::text[]);
  relay := lower(btrim(coalesce(c.email,''))) like '%@privaterelay.appleid.com';
  if relay and not ('email' = any(f)) then
    f := f || 'email'::text;
  end if;
  if coalesce(btrim(c.apple_email),'') <> '' and coalesce(c.password_hash,'') like 'oauth:%'
     and (not relay or 'email' = any(f)) then
    f := f || 'password'::text;
  end if;
  return f;
end $$;
revoke execute on function public._customer_asks(text) from public, anon, authenticated;

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

CREATE OR REPLACE FUNCTION public._staff_ref_broadcast()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  -- CUST_REF_COLS in the client, plus fix_fields (the correction requests the desk flags)
  -- and apple_email (the Apple sign-in address beside a real email, 20260921180000).
  cust_cols constant text[] := array['id','name','email','phone','height','type_preference',
    'gender','birth_date','country','city','nationality','socials','created_at','default_pay',
    'hidden_types','fix_fields','apple_email'];
  n jsonb;
  o jsonb;
begin
  if TG_OP <> 'DELETE' then n := to_jsonb(NEW); end if;
  if TG_OP <> 'INSERT' then o := to_jsonb(OLD); end if;

  if TG_TABLE_NAME = 'customers' then
    if n is not null then
      n := (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(n) where key = any(cust_cols));
    end if;
    if o is not null then
      o := (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(o) where key = any(cust_cols));
    end if;
  end if;

  if TG_OP = 'UPDATE' and n = o then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'op',  TG_OP,
      'id',  coalesce(n->>'id', o->>'id'),
      'row', n,
      -- a deleted rider needs only the id; a tag link needs both halves of its key
      'old', case when TG_TABLE_NAME = 'customers' then null else o end
    ),
    TG_TABLE_NAME,   -- the event: customers | customer_tags | tags
    'staff-ref',
    true             -- private: only a join that passes the policy below receives it
  );
  return null;
end;
$function$;

-- Verify:
--   select count(*) from customers c where lower(c.email) like '%@privaterelay.appleid.com'
--     and cardinality(public._customer_asks(c.id)) = 0;                                  -- expect 0
--   select pg_get_functiondef('public.customer_create_booking(text,text,jsonb)'::regprocedure) like '%FIX_FIRST%';  -- true
--   select pg_get_functiondef('public._staff_ref_broadcast()'::regprocedure) like '%apple_email%';               -- true
-- Then run supabase/checks/security-attributes.sql (expect no rows).
