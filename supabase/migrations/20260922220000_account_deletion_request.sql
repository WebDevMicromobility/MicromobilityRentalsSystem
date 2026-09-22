-- ============================================================================
-- A rider can ask for their account to be deleted, and staff act on it within 30 days.
--
-- APPLIED AND VERIFIED 2026-09-22 (SQL editor, history row recorded): column present,
-- customer_deletion_request a definer callable by anon, security check clean.
--
-- The Personal Data Protection Law gives a rider the right to have data destroyed once it is
-- no longer needed (Art. 4), and the Privacy Notice promises it within 30 days of a request.
-- Until now the only way to ask was by email. This is a REQUEST, not a delete: staff check for
-- live bookings or money owed, then delete the account with the existing staff action (which
-- keeps past bookings under the rider's name, as the law's financial-record retention allows).
--
--  1. customers.deletion_requested_at - when the rider asked; null when there is no request.
--     Staff read it and clear it through their existing table grants.
--  2. customer_deletion_request(p_id, p_token, p_request) - token-checked, the rider's own row
--     only. true asks (the first time is kept), false withdraws, null reads. Returns
--     {requested_at}, or null for a bad token.
--
-- Rollback:
--   drop function if exists public.customer_deletion_request(text,text,boolean);
--   alter table public.customers drop column if exists deletion_requested_at;
-- Idempotent.
-- ============================================================================

begin;

alter table public.customers add column if not exists deletion_requested_at timestamptz;

create or replace function public.customer_deletion_request(p_id text, p_token text, p_request boolean default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  if not _cust_token_ok(p_id, p_token) then return null; end if;
  if p_request is true then
    update customers set deletion_requested_at = now() where id = p_id and deletion_requested_at is null;
  elsif p_request is false then
    update customers set deletion_requested_at = null where id = p_id;
  end if;
  return jsonb_build_object('requested_at', (select deletion_requested_at from customers where id = p_id));
end $function$;

revoke execute on function public.customer_deletion_request(text, text, boolean) from public;
grant  execute on function public.customer_deletion_request(text, text, boolean) to anon, authenticated;

commit;
