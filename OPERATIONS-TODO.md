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

## 0b. Push the Petromin carbon-fare migration BEFORE the site deploys

`supabase/migrations/20260826160000_carbon_fare_on_the_petromin_ride.sql` has to be applied
first, not after. The client now offers Road Carbon on the Petromin Wednesday Ride and quotes
the SAR 175 community fare; until the migration runs, `_comm_no_carbon` still rewrites the
booking to a Road bike and `_enforce_booking_price` still snaps the price back up to the SAR 250
in `ride_prices` — so a rider would be quoted 175 on screen and owe 250 at the booth.

```bash
supabase link --project-ref ariyvnxeywozmwxmylhb   # staging first
supabase db push
# book a Road Carbon place on a Petromin session, confirm the row lands as
#   type_preference='Road Carbon', price=175
supabase link --project-ref amyqxovbnlreassrqihr   # then prod
supabase db push
```

Verify afterwards: `select * from ride_prices where type like 'Road Carbon%';` should show
`Road Carbon` 250 and `Road Carbon@petromin` 175. Delete this section once prod is pushed.

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
