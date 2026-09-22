-- ============================================================================
-- Ride news: a rider's consent to promotional and awareness messages.
--
-- APPLIED AND VERIFIED 2026-09-22 (pasted into the SQL editor, history row recorded):
-- 2,691 accounts, none with ride news; customer_ride_news is a definer; the security check
-- returns no rows. Superseded in one respect by 20260922130000 (a first "no" is recorded).
--
-- The Personal Data Protection Law (Art. 25) forbids using a rider's own contact details -
-- their phone or email - to send promotional or awareness material without their consent,
-- and requires a clear way to stop. Ride news (new rides, schedules, offers, community news,
-- birthday messages) may go only to riders who said yes. Messages about a booking the rider
-- made are part of the service and need nothing here.
--
--  1. customers.ride_news - the rider's answer. False until they tick the box at sign-up or
--     switch it on in their profile; every account that exists today starts at false.
--  2. customers.ride_news_at - when they last chose, either way: the record that they
--     agreed, and when they withdrew. Staff read both through their existing table grants.
--  3. customer_ride_news(p_id, p_token, p_on) - token-checked, the rider's own row only.
--     p_on null reads; true or false sets and stamps the time. Returns {on, at}, or null for
--     a bad token. Staff do not go through here: they turn it off on a rider's STOP reply
--     straight on the table, and have no way to turn it on.
--
-- Rollback:
--   drop function if exists public.customer_ride_news(text,text,boolean);
--   alter table public.customers drop column if exists ride_news_at;
--   alter table public.customers drop column if exists ride_news;
-- Idempotent.
-- ============================================================================

begin;

alter table public.customers add column if not exists ride_news    boolean not null default false;
alter table public.customers add column if not exists ride_news_at timestamptz;

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
     where id = p_id and ride_news is distinct from p_on;
  end if;
  select ride_news, ride_news_at into v_on, v_at from customers where id = p_id;
  return jsonb_build_object('on', v_on, 'at', v_at);
end $function$;

revoke execute on function public.customer_ride_news(text, text, boolean) from public;
grant  execute on function public.customer_ride_news(text, text, boolean) to anon, authenticated;

commit;

-- Check: every account starts at false, and the function is a token-checked definer.
-- select ride_news, count(*) from customers group by 1;
-- select prosecdef from pg_proc where proname = 'customer_ride_news';
-- Then run supabase/checks/security-attributes.sql.
