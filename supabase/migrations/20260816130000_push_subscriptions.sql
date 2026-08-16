-- Web Push subscriptions. 2026-08-16.
--
-- Waitlist promotion currently depends on a 25-second banner appearing on whichever staff
-- phone happens to be awake, and a staffer then opening WhatsApp. Miss the banner and the
-- promoted rider is never told at all. The service worker and the installable PWA have
-- been in place all along; this is the missing half.

create table if not exists public.push_subscriptions (
  id           text primary key,
  customer_id  text not null,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_ok_at   timestamptz,
  fail_count   integer not null default 0
);

comment on table public.push_subscriptions is
  'One row per browser that agreed to notifications. endpoint is unique: re-subscribing the same browser updates rather than duplicates.';
comment on column public.push_subscriptions.fail_count is
  'Consecutive send failures. 410/404 from the push service means the subscription is gone and the row is deleted outright.';

create index if not exists push_subs_customer_idx on public.push_subscriptions (customer_id);

alter table public.push_subscriptions enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Customers never read this table — they only ever add or remove their own device,
-- and both go through the token-checked RPCs below (the same pattern as
-- customer_booking_update). Staff can read it to see who is reachable.
-- The sender runs with the service-role key, which bypasses RLS entirely.
-- ─────────────────────────────────────────────────────────────────────────────
-- Table privileges are NOT implied by a policy, and this Supabase project does not hand
-- new public tables to anon/authenticated by default — that missing-grant behaviour is what
-- broke the last project cutover. Grant SELECT explicitly; RLS below narrows it to staff.
grant select on public.push_subscriptions to authenticated;

drop policy if exists push_subs_staff_read on public.push_subscriptions;
create policy push_subs_staff_read on public.push_subscriptions
  for select using ((select is_staff()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Register (or refresh) this browser for the signed-in customer.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.customer_push_subscribe(
  p_id text, p_token text, p_endpoint text, p_p256dh text, p_auth text, p_ua text
) returns boolean
language plpgsql security definer set search_path to 'public','extensions'
as $function$
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  if coalesce(p_endpoint,'') = '' or coalesce(p_p256dh,'') = '' or coalesce(p_auth,'') = '' then
    return false;
  end if;
  -- Guard against a runaway client filling the table from one account.
  if (select count(*) from push_subscriptions where customer_id = p_id) > 20
     and not exists (select 1 from push_subscriptions where endpoint = p_endpoint) then
    return false;
  end if;

  insert into push_subscriptions (id, customer_id, endpoint, p256dh, auth, user_agent)
  values (encode(gen_random_bytes(12),'hex'), p_id, p_endpoint, p_p256dh, p_auth, left(coalesce(p_ua,''), 200))
  on conflict (endpoint) do update
     set customer_id = excluded.customer_id,
         p256dh      = excluded.p256dh,
         auth        = excluded.auth,
         user_agent  = excluded.user_agent,
         fail_count  = 0;
  return true;
end $function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Unregister this browser. Deliberately does NOT require the endpoint to belong to
-- the caller beyond the token check — a customer removing an endpoint they hold is
-- always safe, and it lets a shared device clean up after itself.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.customer_push_unsubscribe(
  p_id text, p_token text, p_endpoint text
) returns boolean
language plpgsql security definer set search_path to 'public','extensions'
as $function$
begin
  if not _cust_token_ok(p_id, p_token) then return false; end if;
  delete from push_subscriptions where endpoint = p_endpoint and customer_id = p_id;
  return true;
end $function$;

grant execute on function public.customer_push_subscribe(text,text,text,text,text,text)   to anon, authenticated;
grant execute on function public.customer_push_unsubscribe(text,text,text)                to anon, authenticated;
