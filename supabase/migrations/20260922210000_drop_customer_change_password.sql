-- ============================================================================
-- Drop customer_change_password(p_id, p_token, p_new_pwd).
--
-- APPLIED AND VERIFIED 2026-09-22 (Supabase MCP; history row renamed to this file's version).
--
-- It changed a rider's password with nothing but their session token: no current password,
-- no length or strength rule, and anyone could call it (anon and PUBLIC held EXECUTE). A
-- leaked or stolen session token was enough to take the account over for good. Nothing
-- calls it: not the site (app.src.html), not the Pages functions, not the new site
-- (mm-platform) or either form Worker, and no database function; the API logs for the 24 h
-- before the drop show no call (checked 2026-09-22 against 73 calls to customer_profile in
-- the same window). Riders change a password through the two guarded routes:
--   customer_reset(email, phone, new)          - "Forgot password?", proof by email + phone
--   customer_set_own_password(id, token, new)  - only while a temporary password from a
--                                                community approval is waiting (20260922200000)
--
-- Rollback (the definition as it stood, from sql/applied/security-migration.sql):
--   create or replace function public.customer_change_password(p_id text, p_token text, p_new_pwd text)
--    returns boolean language plpgsql security definer set search_path to 'public', 'extensions'
--   as $function$
--   begin
--     if not _cust_token_ok(p_id,p_token) then return false; end if;
--     update customers set password_hash=crypt(p_new_pwd, gen_salt('bf')), session_token=encode(gen_random_bytes(24),'hex') where id=p_id;
--     return true;
--   end $function$;
--   grant execute on function public.customer_change_password(text,text,text) to anon, authenticated;
-- Idempotent.
-- ============================================================================

begin;
drop function if exists public.customer_change_password(text, text, text);
commit;
