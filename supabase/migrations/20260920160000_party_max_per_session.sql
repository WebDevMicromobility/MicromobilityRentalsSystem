-- ─────────────────────────────────────────────────────────────────────────────
-- How big a party may book is a property of the SESSION.
--
-- _group_ride_cap has carried a hard-coded number since it was written: four at
-- first, then two (20260903120000, kept through 20260907120000). Two is right
-- for the Petromin ride — the member and one guest — but it is the wrong number
-- for the Saudi National Day ride, which seats a rider and two guests, and it
-- will be the wrong number again for the next event that is not either of them.
--
-- Everything else that distinguishes one of these rides already lives on the
-- row: paid_ride says whether it charges, open_to_all says who may book,
-- needs_approval says whether staff pick the list, spots says how its places are
-- counted. The party size is the same kind of fact, so it goes in the same
-- place — and deliberately NOT on ride_kind, for the reason the cap's own
-- original comment gives: policy should not turn on a brand name.
--
-- Scope is unchanged: a community ride that does NOT run on approval. Sessions
-- written before this migration have no value and fall back to two, so the
-- Petromin ride is untouched and no existing booking changes meaning.
--
-- The client reads the identical column for its quantity stepper and clamps to
-- the identical ceiling (PARTY_MAX_CEIL in app.src.html), so the number a rider
-- is offered and the number the database will accept cannot drift apart. The
-- ceiling exists because this column is staff-writable: a typo of 300 must not
-- become a coach booking.
--
-- Header attributes are copied from the previous migration, not from prosrc —
-- see the warning in AGENTS.md. Run supabase/checks/security-attributes.sql
-- afterwards.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.sessions add column if not exists party_max int;

CREATE OR REPLACE FUNCTION public._group_ride_cap()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _live int; _cap int;
begin
  if new.customer_id is null or (select is_staff()) then return new; end if;

  -- One lookup does both jobs it used to take an EXISTS for: it decides whether
  -- this rule governs the session at all, and it reads that session's own cap.
  -- No row back means not a ride this rule owns, exactly as before.
  select greatest(1, least(6, coalesce(s.party_max, 2)))
    into _cap
    from sessions s
   where s.id = new.session_id
     and s.event_kind = 'community'
     and coalesce(s.needs_approval, false) = false;

  if _cap is null then return new; end if;

  select count(*) into _live
    from queue_entries q
   where q.session_id = new.session_id
     and q.customer_id = new.customer_id
     and coalesce(q.status,'') not in ('cancelled','removed','noshow')
     and q.id <> new.id;

  if _live >= _cap then
    raise exception 'Up to % riders per booking on this ride.', _cap;
  end if;

  return new;
end $function$;

-- The triggers are bound to the function, not to its body, so CREATE OR REPLACE
-- leaves queue_entries_group_cap and queue_entries_group_cap_upd in place.
