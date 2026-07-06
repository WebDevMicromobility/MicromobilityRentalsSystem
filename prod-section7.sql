-- Section 7: customer-login brute-force lockout (8 fails -> 15 min).
-- Includes the updated customer_login (bcrypt + lockout). Run AFTER Sections 1-4.
-- Safe to re-run.

-- Brute-force throttle: only the customer_login SECURITY DEFINER function touches
-- this; RLS on + no policies means anon cannot read/write it directly.
create table if not exists login_throttle (
  identifier   text primary key,
  fails        int not null default 0,
  locked_until timestamptz
);
alter table login_throttle enable row level security;

-- LOGIN: verify password server-side, rotate a session_token, return profile+token.
-- After 8 consecutive failures for an identifier, lock it out for 15 minutes.
create or replace function customer_login(p_identifier text, p_pwd text)
returns table(
  id text, name text, email text, phone text, height int, type_preference text,
  created_at text, birth_date text, country text, city text, photo text, session_token text
) language plpgsql security definer set search_path = public, extensions as $$
declare r customers%rowtype; tok text; ident text; thr login_throttle%rowtype; nfails int;
begin
  ident := lower(trim(p_identifier));
  select * into thr from login_throttle where identifier = ident;
  if thr.locked_until is not null and thr.locked_until > now() then
    raise exception 'LOCKED' using errcode = 'P0001';   -- too many attempts; the app shows a wait message
  end if;
  -- Columns qualified with customers.*: bare email/phone would be ambiguous
  -- against this function's RETURNS TABLE(... email, phone ...) output names.
  select * into r from customers
   where lower(customers.email) = ident
      or regexp_replace(customers.phone,'\D','','g') = regexp_replace(p_identifier,'\D','','g')
   limit 1;
  if not found or not _cust_pwd_ok(r.password_hash, p_pwd) then
    -- record the failure; a just-expired lock resets the counter first
    nfails := (case when thr.locked_until is not null and thr.locked_until <= now() then 0 else coalesce(thr.fails,0) end) + 1;
    insert into login_throttle(identifier, fails, locked_until)
      values (ident, nfails, case when nfails >= 8 then now() + interval '15 minutes' else null end)
      on conflict (identifier) do update set fails = excluded.fails, locked_until = excluded.locked_until;
    return;
  end if;
  delete from login_throttle where identifier = ident;   -- success clears the counter

  tok := encode(gen_random_bytes(24), 'hex');
  -- Transparent upgrade: re-hash a legacy sha256 password to bcrypt on login.
  if left(r.password_hash, 7) = 'sha256:' then
    update customers set session_token = tok, password_hash = crypt(p_pwd, gen_salt('bf')) where customers.id = r.id;
  else
    update customers set session_token = tok where customers.id = r.id; -- qualified: id is also a RETURNS TABLE output name
  end if;
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $$;
