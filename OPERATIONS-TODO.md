# Operations TODO — actions that need dashboard access (not code)

These are the items from the enhancement plan that can't be done in the repo.
Delete each section when done.

## 0. queue_entries PII — STAGE 1 DONE (2026-08-24), stage 2 pending
`public read` is **dropped**. Verified by impersonating the anon role straight after:
`queue_entries` → 0 rows (was ~2,743 with names, emails and phones), `queue_public` → 2,743
rows, so the app is unaffected. Reads had already moved to that view plus the token-checked
`my_bookings()` RPC.

**Stage 2, still open:** `public insert booking` is deliberately left in place. It is not a PII
leak (price, paid and status are trigger-enforced), and a client older than 2026-08-24 still
flushes OFFLINE bookings by inserting directly. Once the current client has been live a few
days, run:

```sql
drop policy if exists "public insert booking" on public.queue_entries;
```

then make one real booking as a signed-out visitor. Rollback and full reasoning live in
`supabase/migrations/20260820120000_close_queue_entries_public_read.sql`.

## 1. Make CI actually gate deploys (15 min, highest value)
1. Cloudflare dashboard → My Profile → API Tokens → create token ("Edit Cloudflare Workers" template).
2. GitHub repo → Settings → Secrets → add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. Cloudflare → Workers & Pages → micromobilityrentals → Settings → Builds & deployments → disable automatic production deploys.
The existing deploy job in `.github/workflows/ci.yml` detects the secrets and takes over.
Lint + the full Playwright suite then block every deploy.

## 2. Verify booking-confirmation emails are live
Cloudflare Pages → Settings → Environment variables: confirm `BREVO_API_KEY` and
`BREVO_SENDER` are set. If not, the confirm endpoint is a silent no-op and customers
get no email. Also confirm `SUPABASE_ANON_KEY` and `DISCORD_WEBHOOK` are set for
`functions/api/booking-confirm.js` and `functions/api/log-error.js`.

## 2b. Switch on push notifications — keys generated, dashboard steps left
A VAPID keypair has been generated in the exact formats this stack needs (raw-point public,
base64url **PKCS#8** private — what `crypto.subtle.importKey('pkcs8', …)` in
`functions/api/push-send.js` expects) and round-trip verified. `push_subscriptions` exists in
production (0 rows, as expected — nobody can subscribe yet).

The private key is NOT in the repo. It is in this session's scratchpad, readable only by you:
`vapid-keys.json` under `/private/tmp/claude-501/-Users-malik-micromobilityrentals/…/scratchpad/`.
Copy it somewhere durable (a password manager) before that directory is cleaned up; if it is
lost, generating a fresh pair is cheap — it only invalidates existing subscriptions, and there
are none.

Public key (not a secret, it ships in the bundle):
`BCWHRc5qLL-3AMO2DDbTo2ftJxKDOBhleOaNW0fzaPfUV4TW4CKTlzWYw1mv_2kQxl10qqR6xTE6ak06DQqNgBQ`

1. Cloudflare Pages → Settings → Environment variables:
   - `VAPID_PUBLIC_KEY` — the public key above
   - `VAPID_PRIVATE_KEY` — from the scratchpad file
   - `VAPID_SUBJECT` — `mailto:info@micromobility.sa`
   - `SUPABASE_SERVICE_KEY` — service-role key (`push_subscriptions` is not anon-readable)
2. Then ask me to set `VAPID_PUBLIC_KEY` in `app.src.html` and rebuild — one line. It is left
   EMPTY on purpose until the server half is in place: setting it first shows riders a
   subscribe toggle whose notifications would silently never arrive, which is worse than no
   toggle at all.
3. Send one real notification to a test account before relying on it. The encryption is checked
   against the RFC 8291 vector in `tests/push.spec.ts`, but nothing has gone through a live
   push service yet.

## 3. Custom domain
Attach the production domain (per the platform plan: micromobility.sa) to the Pages
project, then set `origin` in **`site.config.json`** and run `npm run build:html`. That one
value now feeds the canonical link, hreflang alternates, JSON-LD, the `og:`/`twitter:`
image URLs, `sitemap.xml` and `robots.txt` — there is nothing else to edit by hand.
Note: `micromobility.sa` currently resolves to an unrelated store, so the DNS has to move
before the domain is attached.

## 4. Supabase migration baseline (one-time)
Follow `supabase/migrations/README.md`: install the CLI, link the prod project, run the
baseline dump, commit it. From then on every schema change is a migration file.

## 5. Uptime monitoring (10 min, free)
Add an UptimeRobot (or Cloudflare Health Check) HTTPS monitor on the live URL with a
keyword check for "MicroMobility". Point alerts at the same channel as the Discord
error webhook.

## 6. Supabase hygiene (quarterly)
- Run the dashboard Advisors (security + performance) and fix findings.
- Consider enabling PITR once revenue justifies it (don't wait for a phase gate).
- Rotate the anon key if it ever leaks in a paste/screenshot; it's public by design
  but rotation invalidates scrapers' cached copies.
- Auth → enable leaked-password protection; consider MFA for staff accounts.

## 7. Accessibility backlog
CI now prints axe-core findings for the landing page (EN and AR/RTL) in the test job
log, report-only. Work the list down; when clean, set `STRICT = true` in
`tests/a11y.spec.ts` to lock it in, then extend the audit to the booking flow and
staff views.

## 8. NFC bike tags and bike assignments (JCC Open Sport Days)
Ship order, because the migration hides ten new `bikes` columns behind column grants and
the old client's `select('*')` on bikes fails the moment they land:
1. `supabase db push` on **staging**, then run `supabase/checks/bike-assignments-rpc.sql`
   (transactional, rolls back) and `supabase/checks/security-attributes.sql`.
2. Deploy the client (push main). It lists bike columns by name and talks to the RPCs,
   falling back to the classic check-in while the functions are absent.
3. `supabase db push` on **production**. Re-run the two checks.

**Provisioning a tag** (one per bike, once; Safari cannot write tags):
- iPhone, free "NFC Tools" app → Write → Add a record → URL/URI →
  `https://micromobilityrentals.pages.dev/?bike=042` (the bike's three-digit number, the
  same one on its sticker) → Write → hold the tag to the top of the phone.
- Tap it once to check: Safari opens the site; signed-in staff see the bike's card, anyone
  else sees the staff sign-in and nothing more.
- Place the tag on the head tube or top tube under a clear sticker, away from the frame's
  metal where the phone can rest flat; the QR sticker (same URL) goes beside it for iPads.
- Only URL records trigger iOS; a text record does nothing.

**At the desk:** run the app in **Safari**, not from a Home Screen icon. A Home Screen app
has its own storage, so the tab iOS opens for a tag would see neither the login nor the
open check-in. Flow: Scan the booking QR (or tap the booking) → the check-in modal opens →
tap the bike's tag with the same phone → the new tab shows the modal with the bike filled
and Confirm focused → Confirm in either tab (the second is a harmless no-op). The open
check-in expires after 15 minutes or on sign-out. Bluetooth HID readers type the tag UID
into the Bike field; an unknown UID typed right after a bike number offers "Link this tag".

Still to build: the register's CSV import for the initial fleet and the Return modal with
condition and notes (returns today still run the classic path).
