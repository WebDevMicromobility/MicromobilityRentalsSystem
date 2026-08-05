-- ============================================================================
-- SATURDAY SOCIAL RIDE: MEMBERS-ONLY BOOKING  (run once in the Supabase SQL editor)
--
-- The ride stays VISIBLE to every signed-in customer (community sessions keep
-- required_tag_id = null, so list_sessions() returns them to everyone), but
-- only members - riders holding the invite-only 'saturday' tag - may continue
-- into the booking flow:
--
--   1. community_member(p_id, p_token): token-checked boolean the app calls
--      when a customer taps the ride, to choose between the booking flow and
--      the members-only dialog. It only answers "is THIS logged-in customer a
--      member": a wrong token is false, so it cannot probe other riders, and
--      the bare boolean reveals nothing else about the tag system.
--
--   2. A queue_entries BEFORE INSERT trigger enforcing the same rule in the
--      database, so a hand-crafted insert with the public anon key cannot
--      bypass the UI gate. Staff inserts (walk-in modal, community Add rider)
--      are exempt via is_staff(): adding a rider from the staff picker is
--      itself the invitation. NOTE: the exemption relies on staff being signed
--      in through Supabase Auth (SECURE_AUTH mode, the production default); in
--      the open-mode override staff act as anon and would be gated too.
--
-- Depends on: tags-events-migration.sql (tags, customer_tags, 'saturday' tag)
--             security-migration.sql   (_cust_token_ok, is_staff)
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1. Membership check for the app ─────────────────────────────────────────
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
       and lower(tg.slug) = 'saturday');
end $$;
grant execute on function community_member(text, text) to anon, authenticated;

-- ── 2. Database-side enforcement on booking ─────────────────────────────────
-- security definer so the membership lookup works from the anon role too
-- (customer_tags is staff-only under RLS; the function owner bypasses it).
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
               and lower(tg.slug) = 'saturday'))
  then
    raise exception 'This ride is for community members only.';
  end if;
  return new;
end $$;

drop trigger if exists queue_entries_community_gate on queue_entries;
create trigger queue_entries_community_gate before insert on queue_entries
  for each row execute function _community_booking_gate();
