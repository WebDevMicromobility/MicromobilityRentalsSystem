-- ============================================================================
-- Every rider confirms they have read the Privacy Notice, and we keep the record.
--
-- APPLIED AND VERIFIED 2026-09-22 (SQL editor, history row recorded): both columns present,
-- customer_consents a definer callable by anon, security check clean.
--
-- The Personal Data Protection Law (Arts. 12-13) requires the notice to be available when
-- we collect a rider's data. Beyond that, the business wants the reading CONFIRMED: sign-up
-- will not go through without the "I have read the Privacy Notice" tick, and accounts that
-- existed before the notice confirm it once, in a popup only an answer closes. This is
-- acknowledgement, not consent - it stays separate from ride news, which remains optional
-- (Art. 7: consent cannot be a condition of the service).
--
--  1. customers.privacy_version - the notice version the rider confirmed (its date,
--     'YYYY-MM-DD', PRIVACY_VERSION in the app). A newer notice asks again.
--  2. customers.privacy_at - when they confirmed it.
--  3. customer_consents(p_id, p_token, p_privacy, p_ride_news) - token-checked, the
--     rider's own row only. Both answers in one place: p_privacy records a confirmation of
--     that version, p_ride_news records the ride-news answer (a first answer is stamped
--     even when it is "no", as in 20260922130000); nulls read. Returns
--     {privacy_version, privacy_at, ride_news, ride_news_at}, or null for a bad token.
--     customer_ride_news stays for now but the app no longer calls it.
--
-- Rollback:
--   drop function if exists public.customer_consents(text,text,text,boolean);
--   alter table public.customers drop column if exists privacy_at;
--   alter table public.customers drop column if exists privacy_version;
-- Idempotent.
-- ============================================================================

begin;

alter table public.customers add column if not exists privacy_version text;
alter table public.customers add column if not exists privacy_at      timestamptz;

create or replace function public.customer_consents(p_id text, p_token text, p_privacy text default null, p_ride_news boolean default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare r record;
begin
  if not _cust_token_ok(p_id, p_token) then return null; end if;
  if p_privacy is not null and p_privacy ~ '^\d{4}-\d{2}-\d{2}$' then
    update customers set privacy_version = p_privacy, privacy_at = now()
     where id = p_id and (privacy_version is distinct from p_privacy or privacy_at is null);
  end if;
  if p_ride_news is not null then
    update customers set ride_news = p_ride_news, ride_news_at = now()
     where id = p_id and (ride_news is distinct from p_ride_news or ride_news_at is null);
  end if;
  select privacy_version, privacy_at, ride_news, ride_news_at into r from customers where id = p_id;
  return jsonb_build_object('privacy_version', r.privacy_version, 'privacy_at', r.privacy_at,
                            'ride_news', r.ride_news, 'ride_news_at', r.ride_news_at);
end $function$;

revoke execute on function public.customer_consents(text, text, text, boolean) from public;
grant  execute on function public.customer_consents(text, text, text, boolean) to anon, authenticated;

commit;
