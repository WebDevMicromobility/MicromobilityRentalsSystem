# Security lockdown — staged plan (do NOT hot-patch production)

## Current state (why the data is exposed today)
The anon key in `index.html` can currently **read all rider PII and edit/delete any
booking** from the browser console. This is because `disable-privacy-lockdown.sql` was
run at some point, which re-opened `SELECT` on `queue_entries` and `cashier_sales`
(the app has been running in the simple `SECURE_AUTH=false` mode).

Key nuance: the world-open `UPDATE`/`DELETE` policies on `queue_entries` are only
dangerous **because SELECT is open** — the design (see `security-migration.sql`
Section 4) is that once SELECT is locked, row ids are random `uid()`s that can't be
enumerated, so writes can't target anything. Re-locking SELECT is therefore what
actually closes the hole.

## The fix already exists: `security-migration.sql`
That file is a complete, section-by-section lockdown with checkpoints and a rollback
block. **Do not run it against live production mid-event.** Run it like this:

1. **Create a Supabase branch** (staging copy) from the dashboard.
2. On the branch, run `security-migration.sql` **Section 1** → set `SECURE_AUTH=true`
   in the app (or `localStorage.cq_secure_auth='1'`) → verify signup / login / profile
   edit / password reset / My Rides all work. Nothing is locked yet (reversible).
3. **Section 2**: create a Supabase Auth user per staff member, fill in their UUIDs in
   the `insert into staff(...)` block. The `staff` table already has a `role` column
   (`admin` | `frontdesk`) — see the escalation note below.
4. **Section 3**: create the `queue_public` no-PII view; confirm it returns rows.
5. **Section 4**: lock the tables. Test as: signed-out (customers table denies), as a
   customer (My Rides works via RPC), as staff (Auth session, tabs load).
6. **Section 6**: staff-only writes on ops tables + cashier_sales.
7. Only after the branch passes end-to-end: run the same on production **in a quiet
   window** (no active Saturday ride), with `SECURE_AUTH=true` shipped first.

## Frontdesk → admin escalation (do at the same time)
`isAdmin()` is client-only (`localStorage.cq_role`), and RLS only checks `is_staff()`,
so a frontdesk staffer can self-promote. The `staff` table already stores `role`, so
once the staff-Auth system (Sections 2/4) is live, add a DB check:

```sql
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from staff where user_id = auth.uid() and role = 'admin');
$$;
```
Then gate the genuinely destructive policies/RPCs (session delete, price edits) on
`is_admin()` instead of `is_staff()`. This only has teeth after the lockdown is live.

## Optional follow-up (Section 5)
Move the booking INSERT and the open UPDATE/DELETE onto token-checked RPCs so writes
are locked too, not just reads. Bigger change (the booking machinery writes directly);
worth doing once the read lockdown is stable.

---
Ping me when you're ready to do this on a branch and I'll drive it with you and test
each checkpoint before we touch production.
