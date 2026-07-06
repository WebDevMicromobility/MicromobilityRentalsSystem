-- Wave 3: bcrypt password hashing. Verifies both bcrypt and legacy sha256;
-- login transparently re-hashes sha256 -> bcrypt. Signup/reset/change take
-- PLAINTEXT now (hashed server-side). Run AFTER Sections 1-4. Safe to re-run.

-- Internal helper: verify a plaintext pwd against a stored hash. Supports bcrypt
-- ('$2...' from crypt(pwd, gen_salt('bf'))) and legacy 'sha256:<salt>:<hex>'.
create or replace function _cust_pwd_ok(p_hash text, p_pwd text)
returns boolean language plpgsql immutable set search_path = public, extensions as $$
declare parts text[];
begin
  if p_hash is null then return false; end if;
  if left(p_hash,2) = '$2' then return p_hash = crypt(p_pwd, p_hash); end if;  -- bcrypt
  if left(p_hash,7) = 'sha256:' then                                            -- legacy salted sha256
    parts := string_to_array(p_hash, ':');
    return encode(digest(parts[2] || ':' || p_pwd, 'sha256'), 'hex') = parts[3];
  end if;
  return false;  -- oauth/legacy: no password login
end $$;

-- LOGIN: verify password server-side, rotate a session_token, return profile+token.
create or replace function customer_login(p_identifier text, p_pwd text)
returns table(
  id text, name text, email text, phone text, height int, type_preference text,
  created_at text, birth_date text, country text, city text, photo text, session_token text
) language plpgsql security definer set search_path = public, extensions as $$
declare r customers%rowtype; tok text;
begin
  -- Columns qualified with customers.*: bare email/phone would be ambiguous
  -- against this function's RETURNS TABLE(... email, phone ...) output names.
  select * into r from customers
   where lower(customers.email) = lower(p_identifier)
      or regexp_replace(customers.phone,'\D','','g') = regexp_replace(p_identifier,'\D','','g')
   limit 1;
  if not found then return; end if;
  if not _cust_pwd_ok(r.password_hash, p_pwd) then return; end if;

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

-- SIGNUP: create the row server-side (so anon needs no INSERT rights), return profile+token.
-- Takes the PLAINTEXT password and bcrypt-hashes it server-side. (drop+create because
-- the 5th parameter was renamed p_pwd_hash -> p_pwd; the grant is re-run below.)
drop function if exists customer_signup(text,text,text,text,text,int,text,text);
create or replace function customer_signup(
  p_id text, p_name text, p_email text, p_phone text, p_pwd text,
  p_height int, p_type_preference text, p_gender text
) returns table(id text, session_token text)
language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  if exists(select 1 from customers
            where (coalesce(p_email,'')<>'' and lower(email)=lower(p_email))
               or (coalesce(p_phone,'')<>'' and phone=p_phone)) then
    raise exception 'DUPLICATE' using errcode = 'unique_violation';
  end if;
  tok := encode(gen_random_bytes(24),'hex');
  insert into customers(id,name,email,phone,password_hash,created_at,height,type_preference,gender,session_token)
  values(p_id,p_name,p_email,p_phone,crypt(p_pwd, gen_salt('bf')),to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         p_height,p_type_preference,p_gender,tok);
  return query select p_id, tok;
end $$;


-- PASSWORD CHANGE (self, while logged in): requires current token. Takes plaintext.
drop function if exists customer_change_password(text,text,text);
create or replace function customer_change_password(p_id text, p_token text, p_new_pwd text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _cust_token_ok(p_id,p_token) then return false; end if;
  update customers set password_hash=crypt(p_new_pwd, gen_salt('bf')), session_token=encode(gen_random_bytes(24),'hex') where id=p_id;
  return true;
end $$;

-- PASSWORD RESET (forgot flow): verify email + phone match, set new password, return profile+token. Takes plaintext.
drop function if exists customer_reset(text,text,text);
create or replace function customer_reset(p_email text, p_phone text, p_new_pwd text)
returns table(
  id text, name text, email text, phone text, height int, type_preference text,
  created_at text, birth_date text, country text, city text, photo text, session_token text
) language plpgsql security definer set search_path = public, extensions as $$
declare r customers%rowtype; tok text;
begin
  select * into r from customers where lower(customers.email)=lower(p_email) limit 1; -- qualified: avoids ambiguity with the RETURNS TABLE email column
  if not found then return; end if;
  if r.password_hash = 'oauth:google' then return; end if;             -- google accounts can't reset here
  if regexp_replace(coalesce(r.phone,''),'\D','','g')
     not like '%'||regexp_replace(coalesce(p_phone,''),'\D','','g') then return; end if;  -- phone must match
  tok := encode(gen_random_bytes(24),'hex');
  update customers set password_hash=crypt(p_new_pwd, gen_salt('bf')), session_token=tok where customers.id=r.id; -- qualified: id is also a RETURNS TABLE output name
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $$;

-- Re-grant the dropped-and-recreated functions (drop removed their grants):
grant execute on function customer_signup(text,text,text,text,text,int,text,text) to anon, authenticated;
grant execute on function customer_change_password(text,text,text)               to anon, authenticated;
grant execute on function customer_reset(text,text,text)                         to anon, authenticated;
