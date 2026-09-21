-- ============================================================================
-- New Apple hidden-email sign-ups are asked for their real email after two completed rides,
-- not at sign-up.
--
-- 20260921150000 asked for the real email and a password inside the Apple sign-up form. The
-- form goes back to what it was, and a new hidden-email account meets the same check-up as
-- the existing ones once it has two rides with status 'done'. The 120 accounts that existed
-- when this shipped (all created before 2026-09-21 09:00 UTC) keep being asked at their next
-- event pick, whatever their ride count.
--
--  1. _customer_asks(p_id): what the check-up asks of an account, in one place.
--       - whatever staff flagged (fix_fields);
--       - 'email' while the main email is an Apple relay address, and the account is one of
--         the existing ones or has two completed rides;
--       - 'password' while an account with an Apple address has no password, but only once
--         its email is being asked (or has already moved off the relay address).
--  2. customer_fix_fields / customer_fix_save use it (bodies otherwise as 20260921150000).
--  3. customer_apple_signup is dropped: nothing calls it any more. A client from before this
--     deploy that still tries it gets "function missing" and signs up the plain way, which it
--     already falls back to.
--
-- Rollback: re-run 20260921150000 (restores both functions and customer_apple_signup), then
--   drop function if exists public._customer_asks(text);
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
  if relay and not ('email' = any(f)) and (
       coalesce(c.created_at,'') < '2026-09-21T09:00:00Z'      -- the accounts that existed at launch
       or (select count(*) from queue_entries q where q.customer_id = c.id and q.status = 'done') >= 2
     ) then
    f := f || 'email'::text;
  end if;
  if coalesce(btrim(c.apple_email),'') <> '' and coalesce(c.password_hash,'') like 'oauth:%'
     and (not relay or 'email' = any(f)) then
    f := f || 'password'::text;
  end if;
  return f;
end $$;
revoke execute on function public._customer_asks(text) from public, anon, authenticated;

create or replace function public.customer_fix_fields(p_id text, p_token text)
returns text[] language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id,p_token) then return null; end if;
  return _customer_asks(p_id);
end $$;
revoke execute on function public.customer_fix_fields(text,text) from public;
grant  execute on function public.customer_fix_fields(text,text) to anon, authenticated;

create or replace function public.customer_fix_save(p_id text, p_token text, p_values jsonb)
returns text[] language plpgsql security definer set search_path = public, extensions as $$
declare
  c      customers%rowtype;
  stored text[];
  flags  text[];
  done   text[] := '{}';
  k text;
  v text;
begin
  if not _cust_token_ok(p_id,p_token) then return null; end if;
  select * into c from customers where customers.id = p_id for update;
  if not found then return null; end if;
  stored := coalesce(c.fix_fields,'{}'::text[]);
  flags := _customer_asks(p_id);
  if p_values is null or jsonb_typeof(p_values) <> 'object' then return flags; end if;

  -- Country and city are answered together: a city belongs to its country, so a flag on
  -- either takes both answers and a new country never keeps the old one's city. The city
  -- may be empty for a country the app has no city list for.
  if 'country' = any(flags) or 'city' = any(flags) then
    v := nullif(btrim(coalesce(p_values->>'country','')),'');
    if v is not null then
      update customers set country = left(v,80),
        city = left(nullif(btrim(coalesce(p_values->>'city','')),''),120)
      where id = p_id;
      done := done || array['country','city'];
    end if;
  end if;

  foreach k in array flags loop
    if not (p_values ? k) then continue; end if;
    if k = 'password' then
      v := p_values->>'password';                                -- a password is taken as typed, never trimmed
      if char_length(coalesce(v,'')) < 8 then continue; end if;
      update customers set password_hash = crypt(v, gen_salt('bf')) where id = p_id;
      done := done || k;
      continue;
    end if;
    v := nullif(btrim(coalesce(p_values->>k,'')),'');
    if v is null then continue; end if;                       -- an empty answer fixes nothing
    case k
      when 'name' then
        if char_length(v) < 2 then continue; end if;
        update customers set name = left(v,120) where id = p_id;
      when 'email' then
        v := lower(v);
        if v !~ '^[^[:space:]@<>"''()]+@[^[:space:]@<>"''()]+\.[^[:space:]@<>"''()]+$' then continue; end if;
        if v like '%@privaterelay.appleid.com' then continue; end if;   -- the main email is a real one
        if exists(select 1 from customers o where o.id <> p_id
                    and (lower(btrim(o.email)) = v or lower(btrim(o.apple_email)) = v)) then
          raise exception 'email_taken' using errcode = '23505';
        end if;
        update customers set email = v where id = p_id;        -- the trigger keeps the relay address
      when 'phone' then
        if v !~ '^\+?[0-9]{8,15}$' then continue; end if;
        if exists(select 1 from customers o where o.phone = v and o.id <> p_id) then
          raise exception 'phone_taken' using errcode = '23505';
        end if;
        update customers set phone = v where id = p_id;
      when 'birth_date' then
        if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then continue; end if;
        update customers set birth_date = v where id = p_id;
      when 'gender' then
        if v not in ('male','female') then continue; end if;
        update customers set gender = v where id = p_id;
      when 'nationality' then update customers set nationality = left(v,80) where id = p_id;
      when 'country', 'city' then continue;                      -- answered above, as a pair
      when 'height' then
        if v !~ '^[0-9]{3}$' or v::int not between 100 and 250 then continue; end if;
        update customers set height = v::int where id = p_id;
      when 'photo' then
        if v !~ '^https://' then continue; end if;                -- Storage URLs only, never a data URL
        update customers set photo = v where id = p_id;
      else continue;
    end case;
    done := done || k;
  end loop;

  -- Only staff flags are stored; the two computed asks disappear once they are answered.
  stored := array(select f from unnest(stored) f where f <> all(done));
  update customers set fix_fields = case when cardinality(stored) = 0 then null else stored end where id = p_id;
  return array(select f from unnest(flags) f where f <> all(done));
end $$;
revoke execute on function public.customer_fix_save(text,text,jsonb) from public;
grant  execute on function public.customer_fix_save(text,text,jsonb) to anon, authenticated;

drop function if exists public.customer_apple_signup(text,text,text,text,int,text,text,text,text,text);

-- Verify:
--   select proname, prosecdef from pg_proc where proname in ('_customer_asks','customer_fix_fields','customer_fix_save');  -- all true
--   select count(*) from pg_proc where proname = 'customer_apple_signup';                                                  -- 0
-- Then run supabase/checks/security-attributes.sql (expect no rows).
