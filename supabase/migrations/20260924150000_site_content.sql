-- ============================================================================
-- What the public website (micromobility.sa) shows, edited from the staff page.
--
-- The owner's rule (2026-09-24): everything on the main website is controlled from the staff
-- page. This is the store for everything staff can change there - texts, photos, prices and
-- which pages are open, in English and Arabic - and the first switch in it: Coming Soon.
-- The website (mm-platform) reads it with the public key; only admins write it.
--
--  1. site_content - one row per piece of content, addressed by a dotted key
--     ('site.coming_soon', 'home.hero.title', ...). The value is JSON: true/false for a switch,
--     {"en": "...", "ar": "..."} for a text, {"url": ..., "alt": {...}} for a photo, a number
--     for a price. Everyone may read it (it is what the public site shows, and nothing else
--     belongs in it); admins insert, change and delete. updated_at/updated_by are set on
--     every write.
--  2. site_content_history - the value before and after every change, who made it and when,
--     so any edit can be seen and put back. Written only by the trigger; admins read it.
--  3. The 'site' bucket - website photos. Public to read (the site shows them); admins upload,
--     replace, list and remove. Images only (JPEG, PNG, WebP, AVIF), 5 MB at most. No SVG: an
--     SVG opened on its own can run script.
--  4. site.coming_soon = true - the website stays on Coming Soon until an admin turns it off.
--     The site treats anything but an explicit false as "closed", and stays closed when it
--     cannot reach the database.
--
-- Rollback:
--   drop policy if exists "site photos upload"  on storage.objects;
--   drop policy if exists "site photos replace" on storage.objects;
--   drop policy if exists "site photos remove"  on storage.objects;
--   drop policy if exists "site photos list"    on storage.objects;
--   delete from storage.buckets where id = 'site';   -- only once the bucket is empty
--   drop table if exists public.site_content_history;
--   drop table if exists public.site_content;
--   drop function if exists public._site_content_log();
--   drop function if exists public._site_content_stamp();
-- Idempotent.
-- ============================================================================

begin;

-- ── 1. The content ──────────────────────────────────────────────────────────
create table if not exists public.site_content (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint site_content_key_shape check (length(key) <= 80 and key ~ '^[a-z][a-z0-9_]*([.][a-z0-9_]+)*$'),
  constraint site_content_value_size check (octet_length(value::text) <= 20000),
  constraint site_content_by_size check (updated_by is null or length(updated_by) <= 120)
);
alter table public.site_content enable row level security;

drop policy if exists "site content public read" on public.site_content;
create policy "site content public read" on public.site_content
  for select to anon, authenticated using (true);
drop policy if exists "site content admin insert" on public.site_content;
create policy "site content admin insert" on public.site_content
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "site content admin update" on public.site_content;
create policy "site content admin update" on public.site_content
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "site content admin delete" on public.site_content;
create policy "site content admin delete" on public.site_content
  for delete to authenticated using ((select public.is_admin()));

revoke all on public.site_content from anon;
grant select on public.site_content to anon;
grant select, insert, update, delete on public.site_content to authenticated;

-- updated_at is the server's clock; updated_by is the operator name the staff page sends,
-- else the signed-in account's email.
create or replace function public._site_content_stamp()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  new.updated_by := left(coalesce(nullif(btrim(new.updated_by), ''), auth.jwt() ->> 'email', 'unknown'), 120);
  return new;
end $function$;
revoke all on function public._site_content_stamp() from public, anon, authenticated;
drop trigger if exists site_content_stamp on public.site_content;
create trigger site_content_stamp before insert or update on public.site_content
  for each row execute function public._site_content_stamp();

-- ── 2. The history ──────────────────────────────────────────────────────────
create table if not exists public.site_content_history (
  id         bigint generated always as identity primary key,
  key        text not null,
  old_value  jsonb,
  new_value  jsonb,
  changed_at timestamptz not null default now(),
  changed_by text
);
create index if not exists site_content_history_key_at on public.site_content_history (key, changed_at desc);
alter table public.site_content_history enable row level security;
drop policy if exists "site content history admin read" on public.site_content_history;
create policy "site content history admin read" on public.site_content_history
  for select to authenticated using ((select public.is_admin()));
revoke all on public.site_content_history from anon, authenticated;
grant select on public.site_content_history to authenticated;

-- Definer: the history has no write policy for anyone; only this trigger writes it.
create or replace function public._site_content_log()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    insert into public.site_content_history(key, old_value, new_value, changed_by)
    values (old.key, old.value, null, left(coalesce(auth.jwt() ->> 'email', 'unknown'), 120));
    return old;
  end if;
  if tg_op = 'UPDATE' and new.value is not distinct from old.value then return new; end if;
  insert into public.site_content_history(key, old_value, new_value, changed_by)
  values (new.key, case when tg_op = 'UPDATE' then old.value end, new.value, new.updated_by);
  return new;
end $function$;
revoke all on function public._site_content_log() from public, anon, authenticated;
drop trigger if exists site_content_log on public.site_content;
create trigger site_content_log after insert or update or delete on public.site_content
  for each row execute function public._site_content_log();

-- ── 3. Website photos ───────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site photos upload" on storage.objects;
create policy "site photos upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site' and (select public.is_admin()));
drop policy if exists "site photos replace" on storage.objects;
create policy "site photos replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'site' and (select public.is_admin()))
  with check (bucket_id = 'site' and (select public.is_admin()));
drop policy if exists "site photos remove" on storage.objects;
create policy "site photos remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site' and (select public.is_admin()));
drop policy if exists "site photos list" on storage.objects;
create policy "site photos list" on storage.objects
  for select to authenticated
  using (bucket_id = 'site' and (select public.is_admin()));

-- ── 4. The first switch ─────────────────────────────────────────────────────
insert into public.site_content (key, value, updated_by)
values ('site.coming_soon', 'true'::jsonb, 'migration')
on conflict (key) do nothing;

commit;
