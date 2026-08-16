-- Make the internal-function revokes actually take effect. 2026-08-16.
--
-- Block 8 of 20260815120000_security_lockdown.sql, and block 2 of 20260816120000_promo_limits.sql,
-- both wrote:
--     revoke execute on function ... from anon, authenticated;
-- and both silently did nothing. PostgreSQL grants EXECUTE on a new function to PUBLIC by
-- default, and revoking from a role does not remove a grant held by PUBLIC — anon and
-- authenticated still reach the function through it. Verified on prod: every one of these
-- shows an ACL of `=X/postgres` (the empty grantee is PUBLIC) and
-- has_function_privilege('anon', …, 'execute') is still true.
--
-- Revoking from PUBLIC is the fix. It is safe for callers that matter, because these are
-- only ever invoked from inside SECURITY DEFINER functions owned by postgres, and a
-- SECURITY DEFINER body runs privilege checks as its owner — who keeps an explicit
-- `postgres=X/postgres` grant. Verified on prod before writing this: with the revoke applied
-- inside a transaction, customer_addon_stock (granted to anon, and a caller of
-- _cust_token_ok) still ran as anon and returned normally; the transaction was rolled back.

-- Token oracles. A caller who knows a customer id could otherwise test candidate session
-- tokens for free. Tokens are 24 random bytes, so this was never the weak link, but it is
-- exactly what block 8 set out to close.
revoke execute on function public._cust_token_ok(text,text)    from public, anon, authenticated;
revoke execute on function public.customer_token_ok(text,text) from public, anon, authenticated;

-- Staff-only password reset. It carries its own `if not is_staff() then return false` guard,
-- so nothing was exploitable — this is the defence in depth block 8 intended.
revoke execute on function public.staff_set_customer_password(text,text) from public, anon;

-- Promo validity. A mild oracle: it reports whether a code is usable by a given customer.
revoke execute on function public._promo_valid(text,text) from public, anon, authenticated;

-- The customer-facing RPCs keep their grants; re-assert them so this migration cannot be
-- read as having narrowed something it did not touch.
grant execute on function public.customer_addon_stock(text,text,jsonb)                     to anon, authenticated;
grant execute on function public.customer_push_subscribe(text,text,text,text,text,text)    to anon, authenticated;
grant execute on function public.customer_push_unsubscribe(text,text,text)                 to anon, authenticated;
