# Project instructions for AI coding agents

MicroMobility — a bicycle rental booking + staff management web app. Customer booking, staff check-in/POS/inventory, EN/AR bilingual. Vanilla JS front end on Supabase, deployed to Cloudflare Pages.

## ⚠️ The #1 rule: `index.html` is GENERATED — do not edit it

The served `index.html` is a **minified build artifact**. The editable source of truth is **`app.src.html`**.

- Edit **`app.src.html`**, then run **`npm run build:html`** to regenerate `index.html`.
- Commit **both** files.
- Never hand-edit `index.html` (it carries a "Generated from app.src.html" banner; your change would be overwritten on the next build).
- The build (`scripts/build-html.mjs`) strips comments + whitespace from the inline JS/CSS but does **not** mangle names — the app references global function names as strings inside `onclick="fn()"` handlers, so renaming breaks it.

## Layout

- `app.src.html` — the whole app (UI + logic + i18n) in one vanilla-JS file. **Edit here.**
- `index.html` — generated minified output (served). Don't edit.
- `styles.css`, `service-worker.js`, `manifest.json`, `*.png` — served static assets.
- `staff/index.html` — tiny redirect stub for the `/staff` entry.
- `_headers`, `_redirects` — Cloudflare Pages config (security + cache headers). Internal files are hidden by `functions/_middleware.js`, not by `_redirects` — see below.
- `robots.txt`, `sitemap.xml` — served SEO files (also copied into dist builds).
- `sql/` — database SQL. `sql/applied/` is the frozen record of hand-run production migrations (incl. `security-migration.sql`, the applied access-control model); `sql/rollbacks/` holds emergency-only undo scripts. See `sql/README.md`.
- `supabase/migrations/` — **all new schema changes go here** via the Supabase CLI (see its README). Never hand-paste schema SQL into the dashboard editor again.
- `SECURITY-RUNBOOK.md` — the production security model (RLS, RPCs) and staging-first procedure.
- `tests/` — Playwright suite (`npm test`); all Supabase traffic is stubbed, tests never touch prod. `tests/a11y.spec.ts` is a report-only axe-core audit (flip `STRICT` once clean).
- `scripts/build-html.mjs` — the minify build. `scripts/check-i18n.mjs` — CI gate enforcing EN/AR/ES key parity in the `LANG` object.

## Backend / Supabase

- Two projects: production `amyqxovbnlreassrqihr`, and an older `ariyvnxeywozmwxmylhb` kept as staging/rollback (a data copy).
- **`SECURE_AUTH` defaults ON in production.** In secure mode the app talks to `SECURITY DEFINER` RPCs + a no-PII `queue_public` view instead of reading the locked tables directly. `localStorage.cq_secure_auth` ('1'/'0') overrides for testing.
- Customer PII: `customers` is staff-only. `queue_entries` was world-readable/writable via the anon key until the lockdown migration `supabase/migrations/20260815120000_security_lockdown.sql`; after it, staff read the table and the public reads the no-PII `queue_public` view. INSERT is still open to anon (the booking form writes directly), so treat it as an untrusted write surface. Writes to `bikes/sessions/inventory/promo_codes` are staff-only. Passwords are bcrypt (login rate-limited). Staff authenticate via Supabase Auth (`staff` table + `is_staff()`).
- Any new customer-side write to a locked table must go through a token-checked RPC (see `customer_booking_update`, `customer_addon_stock` for the pattern) — a direct table write will silently fail under RLS.

## Workflow

- **Deploy** = push to `main` (Cloudflare Pages auto-builds). CI runs the Playwright suite on every push.
- Before committing app changes: `npm run build:html` then `npm test`. `npm run lint` = eslint + tsc + i18n key parity. CI runs lint, a build-freshness check and the suite — but it does NOT gate the deploy: Cloudflare Pages auto-deploys `main` on push regardless (OPERATIONS-TODO.md §1).
- The service worker serves navigations stale-while-revalidate (NOT network-first): a new `index.html` applies on the next load. Other same-origin assets are cache-FIRST with no revalidation, so `styles.css` is busted by a content hash that `scripts/build-html.mjs` writes into both `index.html` and `service-worker.js`. Never hand-edit those version tags.

## Do not expose internal files publicly

Cloudflare Pages serves the repo root, so internal files must be blocked from public serving. The live gate is `functions/_middleware.js` (a **denylist** by extension and path prefix); `_redirects` no longer carries rules. The denylist passes `.html`/`.js`, so a committed prototype directory stays publicly reachable unless its prefix is added. If you add a new served asset, also add it to `FILES` in `scripts/assemble-dist.mjs` — that script now fails the build when a listed file is missing.
