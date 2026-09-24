-- ============================================================================
-- Messages from micromobility.sa - business enquiries (/business) and help-centre messages
-- (/help) - received in the staff page's Messages section.
--
-- The owner's rule (2026-09-24): every submission on the main website is received by the staff
-- page.
--
--  1. site_messages - one row per message. No anon access: the website writes only through
--     site_message_send(); staff read and update, admins delete. The reference a sender sees is
--     "M-" and the id padded to four digits (M-0007); it is computed, not stored.
--  2. site_message_send(p jsonb) - both forms. Anyone may call it; it is metered per network
--     (_ip_gate 'sitemsg', 5 in 10 minutes) and checks every field again. A name, the message
--     and at least one way to answer (email or mobile) are required. The same sender sending
--     the same text within ten minutes gets the same reference back (a double tap). A
--     signed-in rider (customer id + session token) is linked to the message.
--
--  3. The content store (20260924150000) takes the website's own field ids as keys, and those are
--     camelCase (workshop.booking.formTitle, home.entry.bizHref): its key check allowed lowercase
--     only, so those fields could not be saved from the staff page. The check now allows capitals
--     after the first letter.
--
-- Rollback:
--   alter table public.site_content drop constraint if exists site_content_key_shape;
--   alter table public.site_content add constraint site_content_key_shape
--     check (length(key) <= 80 and key ~ '^[a-z][a-z0-9_]*([.][a-z0-9_]+)*$');
--   drop function if exists public.site_message_send(jsonb);
--   drop function if exists public._site_messages_stamp();
--   drop table if exists public.site_messages;
-- Idempotent.
-- ============================================================================

begin;

create table if not exists public.site_messages (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  kind         text not null check (kind in ('business','help')),
  topic        text check (topic is null or topic ~ '^[a-z0-9_-]{1,40}$'),
  name         text not null check (length(name) between 2 and 120),
  company      text check (company is null or length(company) <= 120),
  email        text check (email is null or length(email) <= 254),
  phone        text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  message      text not null check (length(message) between 1 and 2000),
  lang         text not null default 'en' check (lang ~ '^[a-z]{2}$'),
  customer_id  text references public.customers(id) on delete set null,
  status       text not null default 'new' check (status in ('new','replied','closed')),
  staff_notes  text check (staff_notes is null or length(staff_notes) <= 1000),
  updated_at   timestamptz not null default now(),
  updated_by   text check (updated_by is null or length(updated_by) <= 120),
  constraint site_messages_reply_to check (email is not null or phone is not null)
);
create index if not exists site_messages_status_created on public.site_messages (status, created_at desc);
create index if not exists site_messages_kind_created on public.site_messages (kind, created_at desc);
create index if not exists site_messages_customer on public.site_messages (customer_id) where customer_id is not null;
alter table public.site_messages enable row level security;

drop policy if exists "site messages staff read" on public.site_messages;
create policy "site messages staff read" on public.site_messages for select to authenticated using ((select public.is_staff()));
drop policy if exists "site messages staff update" on public.site_messages;
create policy "site messages staff update" on public.site_messages for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "site messages admin delete" on public.site_messages;
create policy "site messages admin delete" on public.site_messages for delete to authenticated using ((select public.is_admin()));
revoke all on public.site_messages from anon, authenticated;
grant select, update, delete on public.site_messages to authenticated;

-- updated_at is the server's clock. updated_by is the operator name the staff page sends with
-- every change; a change that names nobody is signed with the signed-in account's email.
create or replace function public._site_messages_stamp()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and coalesce(new.updated_by, '') = '' then
    new.updated_by := left(coalesce(auth.jwt() ->> 'email', 'unknown'), 120);
  end if;
  return new;
end $function$;
revoke all on function public._site_messages_stamp() from public, anon, authenticated;
drop trigger if exists site_messages_stamp on public.site_messages;
create trigger site_messages_stamp before update on public.site_messages
  for each row execute function public._site_messages_stamp();

create or replace function public.site_message_send(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_kind    text := coalesce(p->>'kind','');
  v_topic   text := nullif(trim(coalesce(p->>'topic','')), '');
  v_name    text := regexp_replace(trim(coalesce(p->>'name','')), '\s+', ' ', 'g');
  v_company text := nullif(regexp_replace(trim(coalesce(p->>'company','')), '\s+', ' ', 'g'), '');
  v_email   text := nullif(lower(trim(coalesce(p->>'email',''))), '');
  v_phone   text := nullif(trim(coalesce(p->>'phone','')), '');
  v_msg     text := trim(coalesce(p->>'message',''));
  v_lang    text := coalesce(nullif(p->>'lang',''), 'en');
  v_cust    text;
  v_prev    bigint;
  v_id      bigint;
begin
  if not _ip_gate('sitemsg', 5, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'error', 'throttled');
  end if;
  if v_kind not in ('business','help') then return jsonb_build_object('ok', false, 'error', 'kind'); end if;
  if v_topic is not null and v_topic !~ '^[a-z0-9_-]{1,40}$' then v_topic := null; end if;
  if v_name = '' or length(v_name) > 120 or not _name_chars_ok(v_name) then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if v_company is not null and length(v_company) > 120 then return jsonb_build_object('ok', false, 'error', 'company'); end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$') then
    return jsonb_build_object('ok', false, 'error', 'email'); end if;
  if v_phone is not null and (v_phone !~ '^\+[1-9][0-9]{7,14}$' or (v_phone like '+966%' and v_phone !~ '^\+9665[0-9]{8}$')) then
    return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  if v_email is null and v_phone is null then return jsonb_build_object('ok', false, 'error', 'contact'); end if;
  if v_msg = '' or length(v_msg) > 2000 then return jsonb_build_object('ok', false, 'error', 'message'); end if;
  if v_lang !~ '^[a-z]{2}$' then v_lang := 'en'; end if;
  if coalesce(p->>'customer_id','') <> '' and coalesce(p->>'token','') <> '' and _cust_token_ok(p->>'customer_id', p->>'token') then
    v_cust := p->>'customer_id';
  end if;

  -- A double tap (or a retry after a lost answer) gets the same reference back.
  perform pg_advisory_xact_lock(hashtext('sitemsg:' || coalesce(v_phone, '') || '|' || coalesce(v_email, '')));
  select id into v_prev from site_messages
   where phone is not distinct from v_phone and email is not distinct from v_email and kind = v_kind
     and md5(message) = md5(v_msg) and created_at > now() - interval '10 minutes'
   order by id desc limit 1;
  if v_prev is not null then
    return jsonb_build_object('ok', true, 'id', v_prev, 'ref', 'M-' || lpad(v_prev::text, 4, '0'), 'repeat', true);
  end if;

  insert into site_messages(kind, topic, name, company, email, phone, message, lang, customer_id, updated_by)
  values (v_kind, v_topic, v_name, v_company, v_email, v_phone, v_msg, v_lang, v_cust, 'website')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'ref', 'M-' || lpad(v_id::text, 4, '0'));
end $function$;
revoke all on function public.site_message_send(jsonb) from public;
grant execute on function public.site_message_send(jsonb) to anon, authenticated;

alter table public.site_content drop constraint if exists site_content_key_shape;
alter table public.site_content add constraint site_content_key_shape
  check (length(key) <= 80 and key ~ '^[a-z][a-zA-Z0-9_]*([.][a-zA-Z0-9_]+)*$');

commit;
