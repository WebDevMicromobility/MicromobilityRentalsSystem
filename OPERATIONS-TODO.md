# Operations TODO — actions that need dashboard access (not code)

These are the items from the enhancement plan that can't be done in the repo.
Delete each section when done.

## 0. Close the queue_entries PII hole (highest value, ~10 minutes)
`supabase/migrations/20260820120000_close_queue_entries_public_read.sql` is written and NOT
applied. It drops the two policies that let the shipped anon key read ~2,000 riders' names,
emails and phones. The reason they stayed open — booking used `.insert().select()` — is gone:
`customer_create_booking()` returns the rows and both call sites use it.
The file carries a four-step pre-flight and its own rollback. Do not apply it blind, and
apply it a day after a deploy (the service worker means some devices still run older code).

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

## 2b. Switch on push notifications
Everything is built and dormant. To activate:

1. Generate a VAPID keypair (P-256). Any web-push tool does it, e.g.
   `npx web-push generate-vapid-keys`.
2. Cloudflare Pages → Settings → Environment variables, add:
   - `VAPID_PUBLIC_KEY` — the public key (base64url). Not a secret.
   - `VAPID_PRIVATE_KEY` — the private key as **base64url PKCS#8**, which is what
     `crypto.subtle.importKey('pkcs8', …)` in `functions/api/push-send.js` expects.
   - `VAPID_SUBJECT` — `mailto:info@micromobility.sa` (defaulted if unset).
   - `SUPABASE_SERVICE_KEY` — service-role key; `push_subscriptions` is not readable
     with the anon key.
3. Set the same public key as `VAPID_PUBLIC_KEY` in `app.src.html` (one `const`, near
   `pushSupported()`), then `npm run build:html`. Until it is set the toggle stays
   hidden and nothing subscribes.
4. Run `supabase/migrations/20260816130000_push_subscriptions.sql`.

Riders opt in from My Account. Manual and automatic waitlist promotions both notify the
booking owner. The encryption is checked against the RFC 8291 test vector in
`tests/push.spec.ts`, but nothing has been sent through a live push service yet — send one
real notification to a test account before relying on it.

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
