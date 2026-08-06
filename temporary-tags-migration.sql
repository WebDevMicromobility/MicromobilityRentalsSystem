-- ============================================================================
-- TEMPORARY CUSTOMER TAGS  (run once in the Supabase SQL editor)
--
-- Staff can now grant a tag permanently (unchanged row shape) or temporarily:
-- customer_tags gains an optional [starts_at, expires_at) window in ms epoch.
-- Null = unbounded, so every existing row stays permanent. A row is ACTIVE only
-- while now() falls inside the window, and every enforcement point honours it:
--
--   1. _ctag_active(): the shared window test.
--   2. community_member(): the members-gate RPC ignores inactive Saturday tags.
--   3. _community_booking_gate(): the queue_entries insert trigger does too.
--   4. list_sessions(): gated (private) sessions are only visible while the
--      required tag is active for that customer.
--
-- Depends on: tags-events-migration.sql, security-migration.sql,
--             saturday-members-gate.sql
-- Idempotent: safe to re-run.
-- ============================================================================

alter table customer_tags add column if not exists starts_at  bigint;
alter table customer_tags add column if not exists expires_at bigint;

-- ── 1. Shared window test ───────────────────────────────────────────────────
create or replace function _ctag_active(p_starts bigint, p_expires bigint)
returns boolean language sql stable as $$
  select (p_starts  is null or p_starts  <= (extract(epoch from now())*1000)::bigint)
     and (p_expires is null or p_expires >  (extract(epoch from now())*1000)::bigint)
$$;

-- ── 2. Members-gate RPC honours the window ──────────────────────────────────
create or replace function community_member(p_id text, p_token text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_id is null or p_token is null or not _cust_token_ok(p_id, p_token) then
    return false;
  end if;
  return exists (
    select 1
      from customer_tags ct
      join tags tg on tg.id = ct.tag_id
     where ct.customer_id = p_id
       and lower(tg.slug) = 'saturday'
       and _ctag_active(ct.starts_at, ct.expires_at));
end $$;
grant execute on function community_member(text, text) to anon, authenticated;

-- ── 3. Booking trigger honours the window ───────────────────────────────────
create or replace function _community_booking_gate()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from sessions s
              where s.id = new.session_id and s.event_kind = 'community')
     and not is_staff()
     and (new.customer_id is null or not exists (
            select 1
              from customer_tags ct
              join tags tg on tg.id = ct.tag_id
             where ct.customer_id = new.customer_id
               and lower(tg.slug) = 'saturday'
               and _ctag_active(ct.starts_at, ct.expires_at)))
  then
    raise exception 'This ride is for community members only.';
  end if;
  return new;
end $$;
-- (the trigger itself already exists from saturday-members-gate.sql; recreating
-- the function is enough, but keep this idempotent for fresh databases)
drop trigger if exists queue_entries_community_gate on queue_entries;
create trigger queue_entries_community_gate before insert on queue_entries
  for each row execute function _community_booking_gate();

-- ── 4. Gated-session visibility honours the window ──────────────────────────
create or replace function list_sessions(p_id text, p_token text)
returns setof sessions language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_id is not null and p_token is not null and _cust_token_ok(p_id, p_token) then
    return query
      select s.* from sessions s
       where s.required_tag_id is null
          or exists (select 1 from customer_tags ct
                      where ct.customer_id = p_id and ct.tag_id = s.required_tag_id
                        and _ctag_active(ct.starts_at, ct.expires_at))
       order by s.session_date;
  else
    return query
      select s.* from sessions s
       where s.required_tag_id is null
       order by s.session_date;
  end if;
end $$;
grant execute on function list_sessions(text, text) to anon, authenticated;
