-- ============================================================================
-- TAGS + PRIVATE EVENTS + APPROVAL  (run once in the Supabase SQL editor)
--
--   1. A tagging system (tags + customer_tags) that ONLY staff can ever read.
--      Customers can never learn that tags exist, let alone which they hold.
--   2. Tag-gated sessions. Every customer automatically holds the 'jcc' tag, so
--      JCC rides behave exactly as before; the Saturday Community Ride is gated
--      on an invite-only tag and is invisible in the DATABASE to everyone else,
--      not merely hidden in the browser.
--   3. A per-booking approval state, so a reservation is not a seat until staff
--      select it (used by the Saturday ride and its waitlist).
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1. TAGS ─────────────────────────────────────────────────────────────────
create table if not exists tags (
  id          text primary key,
  slug        text not null,                 -- stable key used by sessions ('jcc', 'saturday')
  name        text not null,                 -- staff-facing label
  color       text,                          -- hex chip colour in the staff UI
  description text,
  auto_grant  boolean not null default false,-- true = every new account gets it (the 'jcc' tag)
  locked      boolean not null default false,-- true = system tag, cannot be deleted in the UI
  created_at  bigint not null
);
create unique index if not exists tags_slug_uniq on tags (lower(slug));

create table if not exists customer_tags (
  customer_id text not null,
  tag_id      text not null references tags(id) on delete cascade,
  added_by    text,                          -- staff auth uid, for the audit trail
  added_at    bigint not null,
  note        text,
  primary key (customer_id, tag_id)
);
create index if not exists customer_tags_tag_idx  on customer_tags (tag_id);
create index if not exists customer_tags_cust_idx on customer_tags (customer_id);

-- Seed the two system tags.
insert into tags (id, slug, name, color, description, auto_grant, locked, created_at) values
  ('tag_jcc','jcc','JCC Rider','#00e585',
   'Standard access to Jeddah Corniche Circuit rides. Granted automatically to every account. Remove it to block a rider from booking JCC.',
   true, true, (extract(epoch from now())*1000)::bigint),
  ('tag_saturday','saturday','Saturday Community Ride','#4aa8f8',
   'Invite only. Only riders with this tag can see or book the Saturday Community Ride.',
   false, true, (extract(epoch from now())*1000)::bigint)
on conflict (id) do nothing;

-- ── 2. EVERY CUSTOMER GETS THE JCC TAG ──────────────────────────────────────
-- Backfill every existing account.
insert into customer_tags (customer_id, tag_id, added_by, added_at)
select c.id, t.id, 'system', (extract(epoch from now())*1000)::bigint
  from customers c cross join tags t
 where t.auto_grant
on conflict (customer_id, tag_id) do nothing;

-- And every future account, whatever path creates it (password signup, Google,
-- Apple, staff-created). A trigger is used rather than editing each signup RPC
-- so no creation path can ever miss it and leave a rider seeing nothing.
create or replace function _grant_auto_tags()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into customer_tags (customer_id, tag_id, added_by, added_at)
  select new.id, t.id, 'system', (extract(epoch from now())*1000)::bigint
    from tags t where t.auto_grant
  on conflict (customer_id, tag_id) do nothing;
  return new;
end $$;

drop trigger if exists customers_auto_tags on customers;
create trigger customers_auto_tags after insert on customers
  for each row execute function _grant_auto_tags();

-- ── 3. SESSION GATING ───────────────────────────────────────────────────────
-- required_tag_id null = open to anyone (incl. signed-out); set = private event.
alter table sessions add column if not exists required_tag_id text references tags(id);
alter table sessions add column if not exists needs_approval  boolean not null default false;
alter table sessions add column if not exists hide_queue      boolean not null default false;
alter table sessions add column if not exists spots           integer;   -- hard cap for private events
alter table sessions add column if not exists title           text;      -- 'Saturday Community Ride'
alter table sessions add column if not exists event_kind      text;      -- 'jcc' | 'community'
create index if not exists sessions_required_tag_idx on sessions (required_tag_id);

-- Existing sessions are all JCC rides. They are left UNGATED on purpose: every
-- account already carries the 'jcc' tag, so gating them would change nothing for
-- riders while adding a real failure mode (one missed tag = a rider who can see
-- no rides at all, and signed-out visitors lose the landing availability strip).
-- Only genuinely private events (the Saturday ride) get a required_tag_id.
update sessions
   set event_kind = coalesce(event_kind,'jcc')
 where status <> 'deleted';

-- ── 4. BOOKING APPROVAL ─────────────────────────────────────────────────────
-- null       = ordinary session, nothing to approve (existing behaviour).
-- 'pending'  = reserved, staff have not selected them yet.
-- 'approved' = staff selected them; a real seat.
-- 'rejected' = staff declined.
alter table queue_entries add column if not exists approval text;
create index if not exists queue_entries_approval_idx on queue_entries (session_id, approval);

-- ============================================================================
-- 5. RLS -- the part that actually hides private events
-- ============================================================================

-- Tags are staff-only, always. No anon policy exists, so a customer cannot read
-- the tag list or customer_tags, and cannot discover that tagging exists.
alter table tags          enable row level security;
alter table customer_tags enable row level security;
drop policy if exists "staff full" on tags;
drop policy if exists "staff full" on customer_tags;
create policy "staff full" on tags          for all using (is_staff()) with check (is_staff());
create policy "staff full" on customer_tags for all using (is_staff()) with check (is_staff());

-- Sessions: replace the old blanket "public read using (true)". Public may read
-- only ungated sessions; gated ones are reachable exclusively through the
-- token-checked list_sessions() RPC. Staff keep full access via is_staff().
alter table sessions enable row level security;
drop policy if exists "public read" on sessions;
drop policy if exists "public read ungated" on sessions;
drop policy if exists "staff write" on sessions;
create policy "public read ungated" on sessions
  for select using (required_tag_id is null);
create policy "staff write" on sessions
  for all using (is_staff()) with check (is_staff());

-- ============================================================================
-- 6. list_sessions() -- the only way a customer sees a gated session
-- ============================================================================
-- Returns ungated sessions plus the gated ones this customer is tagged for. A
-- bad/absent token yields only the ungated list, so signed-out browsing still
-- works and a wrong token never reveals a private event. Nothing in the result
-- hints that gating exists -- the customer just receives their sessions.
create or replace function list_sessions(p_id text, p_token text)
returns setof sessions language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_id is not null and p_token is not null and _cust_token_ok(p_id, p_token) then
    return query
      select s.* from sessions s
       where s.required_tag_id is null
          or exists (select 1 from customer_tags ct
                      where ct.customer_id = p_id and ct.tag_id = s.required_tag_id)
       order by s.session_date;
  else
    return query
      select s.* from sessions s
       where s.required_tag_id is null
       order by s.session_date;
  end if;
end $$;
grant execute on function list_sessions(text, text) to anon, authenticated;

-- ============================================================================
-- 7. Notes
-- ============================================================================
-- * Approval is staff-owned. customer_booking_update()'s whitelist does not
--   include `approval`, so a customer can never approve themselves; the booking
--   INSERT sets 'pending' and only staff move it forward. Cancelling/withdrawing
--   still works through the existing whitelist, so that RPC needs no change.
-- * Staff approve/reject with a normal authenticated UPDATE on queue_entries,
--   covered by the existing staff policy -- no extra RPC needed.
