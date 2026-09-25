-- 20260925220000_website_handoff
--
-- 1. Signing in on micromobility.sa through the booking app. The website's account page sends a
--    rider here to sign up, sign in with Google or Apple, or reset a password (?handoff=site); once
--    signed in, the booking app asks for a one-time code and sends the rider back to
--    micromobility.sa/api/account/handoff?code=..., where the website trades it for the session.
--    A code is 48 hex characters, good for two minutes and for one use. Nobody reads the table:
--    only these two functions touch it.
-- 2. Staff can now write a website text in its other fourteen languages (Website editor), so one
--    field's value can hold sixteen versions: the size limit for a non-Journal row goes from
--    20 000 to 60 000 bytes.

create table if not exists public.customer_handoffs (
  code text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.customer_handoffs enable row level security;
revoke all on public.customer_handoffs from anon, authenticated;

-- A signed-in rider's code (their id and session token prove who they are); null when they do
-- not match. Old codes are cleared as new ones are made.
create or replace function public.customer_handoff_create(p_id text, p_token text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare c text;
begin
  if p_id is null or p_token is null or not _cust_token_ok(p_id, p_token) then
    return null;
  end if;
  delete from customer_handoffs where created_at < now() - interval '10 minutes';
  c := encode(gen_random_bytes(24), 'hex');
  insert into customer_handoffs(code, customer_id) values (c, p_id);
  return c;
end $function$;

-- The session a code stands for, once: a used, unknown or expired code answers no row.
create or replace function public.customer_handoff_redeem(p_code text)
returns table(id text, name text, session_token text)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare cid text;
begin
  if p_code is null or p_code !~ '^[0-9a-f]{48}$' then
    return;
  end if;
  update customer_handoffs h set used_at = now()
   where h.code = p_code and h.used_at is null and h.created_at > now() - interval '2 minutes'
   returning h.customer_id into cid;
  if cid is null then
    return;
  end if;
  return query
    select c.id, c.name, c.session_token from customers c
     where c.id = cid and coalesce(c.session_token, '') <> '';
end $function$;

revoke all on function public.customer_handoff_create(text, text) from public;
revoke all on function public.customer_handoff_redeem(text) from public;
grant execute on function public.customer_handoff_create(text, text) to anon, authenticated;
grant execute on function public.customer_handoff_redeem(text) to anon, authenticated;

alter table public.site_content drop constraint if exists site_content_value_size;
alter table public.site_content add constraint site_content_value_size
  check (octet_length(value::text) <= case when key like 'journal.%' then 150000 else 60000 end);
