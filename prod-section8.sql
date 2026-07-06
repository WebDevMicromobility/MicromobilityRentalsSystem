-- Extend rate-limiting to the password-reset flow (throttles by email so a
-- known email can't be brute-forced on the phone check). Reuses login_throttle
-- from Section 7. Run AFTER Sections 1-7. Safe to re-run.

-- PASSWORD RESET (forgot flow): verify email + phone match, set new password, return profile+token. Takes plaintext.
drop function if exists customer_reset(text,text,text);
create or replace function customer_reset(p_email text, p_phone text, p_new_pwd text)
returns table(
  id text, name text, email text, phone text, height int, type_preference text,
  created_at text, birth_date text, country text, city text, photo text, session_token text
) language plpgsql security definer set search_path = public, extensions as $$
declare r customers%rowtype; tok text; ident text; thr login_throttle%rowtype; nfails int;
begin
  -- Rate-limit reset by email so a known email can't be brute-forced on the phone
  -- check. Keyed 'reset:'+email so it's separate from the login throttle.
  ident := 'reset:'||lower(trim(p_email));
  select * into thr from login_throttle where identifier = ident;
  if thr.locked_until is not null and thr.locked_until > now() then return; end if; -- silently throttled
  select * into r from customers where lower(customers.email)=lower(p_email) limit 1; -- qualified: avoids ambiguity with the RETURNS TABLE email column
  if not found or r.password_hash = 'oauth:google'                        -- no account / google account
     or regexp_replace(coalesce(r.phone,''),'\D','','g')
        not like '%'||regexp_replace(coalesce(p_phone,''),'\D','','g') then -- phone must match
    nfails := (case when thr.locked_until is not null and thr.locked_until <= now() then 0 else coalesce(thr.fails,0) end) + 1;
    insert into login_throttle(identifier, fails, locked_until)
      values (ident, nfails, case when nfails >= 8 then now() + interval '15 minutes' else null end)
      on conflict (identifier) do update set fails = excluded.fails, locked_until = excluded.locked_until;
    return;
  end if;
  delete from login_throttle where identifier = ident;   -- success clears
  tok := encode(gen_random_bytes(24),'hex');
  update customers set password_hash=crypt(p_new_pwd, gen_salt('bf')), session_token=tok where customers.id=r.id; -- qualified: id is also a RETURNS TABLE output name
  return query select r.id, r.name, r.email, r.phone, r.height, r.type_preference,
    r.created_at, r.birth_date, r.country, r.city, r.photo, tok;
end $$;

grant execute on function customer_reset(text,text,text) to anon, authenticated;
