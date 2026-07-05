# Security Runbook — Customer PII Lockdown

**Goal:** stop the public anon key from reading customer PII (names/emails/phones) and other riders' bookings, while keeping login, signup, profile, My Rides, and the staff tabs working.

**Why it's needed:** `index.html` ships the Supabase anon key, and every table currently has a `for all using (true)` policy. The staff PIN is client-side only — it does **not** protect the database. Anyone can use the anon key to dump `customers`.

**The two moving parts**
1. `security-migration.sql` — run in the Supabase SQL editor, section by section.
2. `const SECURE_AUTH` in `index.html` — a flag (default `false`). When `true`, the app talks to the new RPCs and the `queue_public` view instead of querying tables directly. **All wiring is now in the code** behind this flag: customer signup/login/profile/photo/reset, Google sign-in (`customer_oauth_login`/`customer_oauth_signup`), the customer's own bookings via `my_bookings()`, availability via `queue_public`, and staff sign-in via Supabase Auth (`staffAuthSignIn`, replacing the PIN as the DB gate — PIN stays as a first step).

**Enabling the flag without editing code:** set `localStorage.setItem('cq_secure_auth','1')` in the browser console (or `'0'` to force off). This is how to run secure mode on staging and in tests; the `tests/secure.spec.ts` suite covers login-via-RPC, the `queue_public`+`my_bookings` merge, the stale-unlock→PIN fallback, and staff Auth sign-in. Flip the source default to `true` only at the production cutover (Phase 5).

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
4. **Already wired.** With `SECURE_AUTH` on, entering the correct PIN advances to a staff email/password form (`_staffAuthSubmit` → `staffAuthSignIn`), which signs in via Supabase Auth and reads the row's role from the `staff` table. On boot, `staffAuthRestore()` drops a stale `cq_staff` unlock if there is no live Auth session mapping to a staff row (so a copied localStorage flag can't get in). The Lock button (`lockStaff()`) signs the Auth session out. Nothing to paste.

5. Verify on staging: a staff member enters the PIN, then signs in with the Auth account created above, and can load Queue/Sessions/Bikes tabs. An unlocked device with no Auth session must fall back to the PIN gate on reload.

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
