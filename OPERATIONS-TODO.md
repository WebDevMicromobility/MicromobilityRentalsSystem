# Operations TODO — actions that need dashboard access (not code)

These are the items from the enhancement plan that can't be done in the repo.
Delete each section when done.

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

## 3. Custom domain
Attach the production domain (per the platform plan: micromobility.sa) to the Pages
project, then update in one commit: canonical + JSON-LD urls in `app.src.html` (search
"micromobilityrentals.pages.dev"), `robots.txt`, `sitemap.xml`, and the `og:` /
`twitter:` image URLs. Rebuild with `npm run build:html`.

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
