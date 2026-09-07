-- ─────────────────────────────────────────────────────────────────────────────
-- The Micromobility Triathlon Workshop: a community session anyone may book.
--
-- Run with the Saudi Triathlon Federation, the workshop has the Saturday ride's
-- shape end to end — staff approve the list, the queue stays hidden until it is
-- published, one place per person, complimentary — and, like the pool session,
-- no bicycle. What is new is WHO may book: every signed-in customer, no tag.
--
-- Until now "community" meant "members only" in the database: the booking gate
-- trigger turns away any customer without the Community tag. So the gate gains
-- an off switch on the session itself, open_to_all, which the app reads for the
-- same decision (whether to show the members dialog). One column, two readers,
-- no way to drift. ride_kind stays display-only, as the paid-rides migration
-- promised: no policy here reads it.
--
-- The second change makes the "one place per person" promise real. The client
-- has always clamped an approval booking to one rider and refused a second
-- reservation on the same session, but nothing in the database did; the group
-- cap only ever covered seat-based rides. _solo_ride_cap is that rule for the
-- approval rides (Saturday, pool, workshop): one live booking per account per
-- session. Staff are exempt, exactly as they are from the group cap.
--
-- Headers below are copied from the previous definitions, not from prosrc (see
-- AGENTS.md): _community_booking_gate stays SECURITY DEFINER because it reads
-- customer_tags, which is staff-only; _solo_ride_cap is definer because it
-- counts queue_entries rows the calling customer can no longer see.
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Who may book is a property of the session ────────────────────────────
alter table public.sessions add column if not exists open_to_all boolean not null default false;

-- ── 2. The members gate steps aside for an open session ─────────────────────
-- Unchanged from temporary-tags-migration.sql except the one extra condition.
create or replace function public._community_booking_gate()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from sessions s
              where s.id = new.session_id
                and s.event_kind = 'community'
                and coalesce(s.open_to_all, false) = false)
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

-- ── 3. One place per account on an approval session ─────────────────────────
create or replace function public._solo_ride_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare _live int;
begin
  if new.customer_id is null or (select is_staff()) then return new; end if;

  if not exists (select 1 from sessions s
                  where s.id = new.session_id
                    and s.event_kind = 'community'
                    and coalesce(s.needs_approval, false) = true) then
    return new;
  end if;

  select count(*) into _live
    from queue_entries q
   where q.session_id = new.session_id
     and q.customer_id = new.customer_id
     and coalesce(q.status, '') not in ('cancelled', 'removed', 'noshow')
     and q.id <> new.id;

  if _live >= 1 then
    raise exception 'One place per person on this session.';
  end if;

  return new;
end $$;

drop trigger if exists queue_entries_solo_cap on public.queue_entries;
create trigger queue_entries_solo_cap before insert on public.queue_entries
  for each row execute function public._solo_ride_cap();

-- Moving an existing booking INTO an approval session is a second way in.
drop trigger if exists queue_entries_solo_cap_upd on public.queue_entries;
create trigger queue_entries_solo_cap_upd
  before update on public.queue_entries
  for each row
  when (new.session_id is distinct from old.session_id)
  execute function public._solo_ride_cap();
