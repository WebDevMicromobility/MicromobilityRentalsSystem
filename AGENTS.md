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
- `_headers`, `_redirects` — Cloudflare Pages config (security headers; the allowlist that hides internal files — see below).
- `robots.txt`, `sitemap.xml` — served SEO files (also copied into dist builds).
- `sql/` — database SQL. `sql/applied/` is the frozen record of hand-run production migrations (incl. `security-migration.sql`, the applied access-control model); `sql/rollbacks/` holds emergency-only undo scripts. See `sql/README.md`.
- `supabase/migrations/` — **all new schema changes go here** via the Supabase CLI (see its README). Never hand-paste schema SQL into the dashboard editor again.
- `SECURITY-RUNBOOK.md` — the production security model (RLS, RPCs) and staging-first procedure.
- `tests/` — Playwright suite (`npm test`); all Supabase traffic is stubbed, tests never touch prod. `tests/a11y.spec.ts` is a report-only axe-core audit (flip `STRICT` once clean).
- `scripts/build-html.mjs` — the minify build. `scripts/check-i18n.mjs` — CI gate enforcing EN/AR/ES key parity in the `LANG` object.

## Backend / Supabase

- Two projects: production `amyqxovbnlreassrqihr`, and an older `ariyvnxeywozmwxmylhb` kept as staging/rollback (a data copy).
- **`SECURE_AUTH` defaults ON in production.** In secure mode the app talks to `SECURITY DEFINER` RPCs + a no-PII `queue_public` view instead of reading the locked tables directly. `localStorage.cq_secure_auth` ('1'/'0') overrides for testing.
- Customer PII (`customers`, `queue_entries`) is not readable by the public anon key. Writes to `bikes/sessions/inventory/promo_codes` are staff-only. Passwords are bcrypt (login rate-limited). Staff authenticate via Supabase Auth (`staff` table + `is_staff()`).
- Any new customer-side write to a locked table must go through a token-checked RPC (see `customer_booking_update`, `customer_addon_stock` for the pattern) — a direct table write will silently fail under RLS.

## Workflow

- **Deploy** = push to `main` (Cloudflare Pages auto-builds). CI runs the Playwright suite on every push.
- Before committing app changes: `npm run build:html` then `npm test`. `npm run lint` = eslint + tsc + i18n key parity, and it runs as a blocking CI step — keep it green.
- The service worker serves navigations network-first, so `index.html` changes go live without a cache bump.

## Do not expose internal files publicly

Cloudflare Pages serves the repo root, so `_redirects` is an **allowlist**: only the app's static assets are served; everything else (this file, `app.src.html`, `*.sql`, docs, configs, `tests/`) returns 404 to the public. If you add a new **served** asset, add it to the allowlist in `_redirects`. Do not remove the catch-all `/*  /404.html  404` rule.
