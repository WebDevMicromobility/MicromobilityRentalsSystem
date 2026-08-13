-- ============================================================================
-- Staff-set-customer-password RPC  (run once in the Supabase SQL editor)
--
-- Lets a signed-in staff member set a customer's password from the staff panel's
-- "Edit customer" modal. Bcrypt-hashed SERVER-SIDE (never in the browser), guarded
-- by is_staff() so only authenticated staff can call it, and rotates the customer's
-- session_token so any existing logins are invalidated (a password change should log
-- other devices out). Idempotent — safe to re-run.
--
-- Requires: the customers table + is_staff() from security-migration.sql (both live).
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function staff_set_customer_password(p_customer_id text, p_new_pwd text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_staff() then return false; end if;                 -- only authenticated staff
  if length(coalesce(p_new_pwd,'')) < 8 then return false; end if;  -- server-side floor
  update customers
     set password_hash = crypt(p_new_pwd, gen_salt('bf')),      -- bcrypt (matches customer_login)
         session_token = encode(gen_random_bytes(24),'hex')     -- rotate: invalidate old sessions
   where id = p_customer_id;
  return found;
end $$;

grant execute on function staff_set_customer_password(text,text) to anon, authenticated;
