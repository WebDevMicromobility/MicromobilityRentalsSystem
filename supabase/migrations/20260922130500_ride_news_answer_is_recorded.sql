-- ============================================================================
-- A first answer to ride news is recorded, even when it is "no".
--
-- APPLIED AND VERIFIED 2026-09-22 (SQL editor). Renumbered from 20260922130000, which
-- cancel_reason also took; its history row is recorded under 20260922130500. Superseded for
-- the app by customer_consents (20260922140000), which records the answer the same way.
--
-- 20260922120000 stamped ride_news_at only when the answer CHANGED. Every account starts at
-- false, so a rider who answers "No thanks" changed nothing and was left looking as if never
-- asked - and riders who have never answered are asked, once, in a popup. ride_news_at is
-- now also stamped when it is still empty: it means "has answered", whichever way.
--
-- Unchanged otherwise. SECURITY DEFINER and the search_path are restated on purpose:
-- CREATE OR REPLACE drops them.
-- Rollback: re-run the function from 20260922120000_ride_news_consent.sql. Idempotent.
-- ============================================================================

begin;

create or replace function public.customer_ride_news(p_id text, p_token text, p_on boolean default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_on boolean; v_at timestamptz;
begin
  if not _cust_token_ok(p_id, p_token) then return null; end if;
  if p_on is not null then
    update customers set ride_news = p_on, ride_news_at = now()
     where id = p_id and (ride_news is distinct from p_on or ride_news_at is null);
  end if;
  select ride_news, ride_news_at into v_on, v_at from customers where id = p_id;
  return jsonb_build_object('on', v_on, 'at', v_at);
end $function$;

revoke execute on function public.customer_ride_news(text, text, boolean) from public;
grant  execute on function public.customer_ride_news(text, text, boolean) to anon, authenticated;

commit;
