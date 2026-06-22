# Security Runbook — Customer PII Lockdown

**Goal:** stop the public anon key from reading customer PII (names/emails/phones) and other riders' bookings, while keeping login, signup, profile, My Rides, and the staff tabs working.

**Why it's needed:** `index.html` ships the Supabase anon key, and every table currently has a `for all using (true)` policy. The staff PIN is client-side only — it does **not** protect the database. Anyone can use the anon key to dump `customers`.

**The two moving parts**
1. `security-migration.sql` — run in the Supabase SQL editor, section by section.
2. `const SECURE_AUTH` in `index.html` — a flag (default `false`). When `true`, the app talks to the new RPCs instead of querying tables directly. The customer-side wiring is already in the code behind this flag.

> ⛔ **Golden rule:** do the whole thing on a **staging Supabase project** first (clone of prod). A wrong RLS policy locks out every login. Never run Section 4 on production until staging passes every checkpoint.

---

## Phase 0 — Make a staging project
1. Create a second Supabase project (`micromobility-staging`).
2. Run `supabase_schema.sql` in it to create the tables.
3. Copy a sample of prod data in (optional) or just create a couple of test customers via the live app pointed at staging.
4. In a **local copy** of `index.html`, swap the Supabase URL + anon key to the staging project (search for `createClient`).

## Phase 1 — Customer RPCs (safe, reversible)
1. Run **Section 1** of `security-migration.sql` on staging.
2. In your local staging `index.html`, set `const SECURE_AUTH = true;` (top of the main `<script>`).
3. Test, in this order: **signup → log out → log in → edit profile → change photo → My Rides → log out → forgot-password reset → log in with the new password.**
4. All must pass. If something breaks, set `SECURE_AUTH=false` (instant rollback) and check the failing RPC in the SQL editor. Nothing is locked yet.

## Phase 2 — Staff Supabase Auth
1. Dashboard → **Authentication → Users → Add user**: create one email/password login per staff member.
2. Copy each new user's **UUID**.
3. Run **Section 2**, then run the `insert into staff(...)` statement with those UUIDs (and each person's role: `admin` or `frontdesk`).
4. Wire staff sign-in in the app — paste this near the existing PIN logic and call it when staff unlock. (Apply now, on staging.)

```js
// Staff sign-in via Supabase Auth (replaces trusting the client-side PIN for DB access).
async function staffAuthSignIn(email, password){
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { toast(error.message, 'error'); return false; }
  // pull role from the staff table for UI gating
  const { data: row } = await sb.from('staff').select('role').eq('user_id', data.user.id).maybeSingle();
  setStaffRole(row?.role === 'frontdesk' ? 'frontdesk' : 'admin');
  return true;
}
async function staffAuthSignOut(){ try{ await sb.auth.signOut(); }catch(e){} }
```

> Replace the PIN modal's success path with a tiny email+password form that calls `staffAuthSignIn`. Keep `isAdmin()` reading `S.staffRole`, which now comes from the `staff` table. The PIN can stay as a *second* factor if you like, but DB access must come from the Auth session.

5. Verify: a signed-in staff user can still load the Queue/Sessions/Bikes/Customers tabs (these read `customers`/`queue_entries` directly — still allowed because the tables aren't locked yet).

## Phase 3 — Public availability view
1. Run **Section 3** (creates `queue_public`).
2. Point the **customer booking/availability** read at the view, and the customer's own rides at the RPC. (Apply on staging.)

```js
// When SECURE_AUTH and NOT staff: availability comes from the no-PII view,
// and the logged-in customer's own rows come from my_bookings().
async function loadQueueForCustomer(){
  const pub = await sb.from('queue_public').select('*');
  let mine = { data: [] };
  const s = S.loggedIn || getSession();
  if (s && s.session_token) mine = await sb.rpc('my_bookings', { p_id: s.id, p_token: s.session_token });
  return [ ...(pub.data||[]), ...(mine.data||[]) ];
}
```

> In `loadData()`, branch: `if (SECURE_AUTH && S.view==='customer' && !isStaffAuthed()) use loadQueueForCustomer(); else sb.from('queue_entries').select('*')`. Staff keep the full table read (they're authenticated).

3. Verify customer booking still shows correct availability and My Rides shows the customer's own bookings.

## Phase 4 — Lock the tables (the real fix)
1. Confirm: staging app has `SECURE_AUTH=true`, staff sign in via Auth, customer flows pass.
2. Run **Section 4**.
3. Verify **as an anonymous visitor** (incognito, not logged in): in the SQL editor with the anon role, `select * from customers;` → **permission denied / 0 rows**. 🎉 PII is now private.
4. Re-verify the full app: customer signup/login/profile/My Rides, staff all tabs.

## Phase 5 — Production
1. Only after every staging checkpoint passes: run Sections 1–4 on **production**, in order, pausing to test between each.
2. Create the production staff Auth users + `staff` rows.
3. Deploy `index.html` with `SECURE_AUTH = true`.
4. Smoke-test production with a real and an incognito browser.

---

## Rollback (any phase)
- **App-level (instant):** set `SECURE_AUTH = false` and redeploy → app uses the old direct-query auth.
- **DB-level:** run the **ROLLBACK** block at the bottom of `security-migration.sql` to restore the open `public access` policies.

## What this does and doesn't cover
- ✅ Customer PII (`customers`) no longer readable by the public anon key.
- ✅ Other riders' booking PII no longer readable by the public; availability still works via the view.
- ✅ Staff get access through real authenticated accounts, not a client-side flag.
- ◻️ Optional follow-ups (Section 5 of the SQL): customer self-cancel RPC, bcrypt password hashing, and locking writes on `bikes`/`sessions`/`inventory`/`promo_codes` to staff.
