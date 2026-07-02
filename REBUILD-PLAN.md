# Rebuild Plan — Strangler Rewrite

Goal: evolve the current single-file app into a modern, modular, tested codebase **without ever taking the site down**. The old app is the spec; the Playwright suite is the contract that proves each step didn't break it.

## Current state (July 2026)

- `index.html` — ~10.9k lines, all UI + logic + i18n (EN/AR) in one file, vanilla JS
- `styles.css` + hand-versioned `service-worker.js` (cache bump needed in 3 places per release)
- Supabase called directly from the browser (`customers`, `bikes`, `sessions`, `queue_entries`, `cashier_sales`, `promo_codes`, `inventory`)
- `app.py` / `schema.sql` — dead Flask prototype, reference only
- Deploy = push to `main`
- Tests: `npm test` (Playwright, chromium desktop + mobile profiles). All Supabase traffic is stubbed in `tests/helpers/supabase.ts` — **tests never touch production data**.

## Phase 0 — Safety net (DONE, keep growing it)

- [x] Playwright scaffold, Supabase network stubbed
- [x] Landing, i18n/RTL, PIN gate, staff panel, QR scan check-in specs
- [ ] Booking flow spec (fixture session → reserve → ticket shown)
- [ ] POS spec (record sale → receipt → refund restores stock)
- [ ] Close-out and analytics totals spec (pure-logic assertions)
- [ ] Offline snapshot spec (kill network route → cached data still renders)

Rule: **before migrating a module in Phase 2, its behavior must be covered here first.**

## Phase 1 — Toolchain

- Vite + TypeScript, `index.html` becomes the Vite entry
- Build output keeps the same deploy model (static files, push to main)
- Hashed asset filenames from the build kill the manual `?v=68` / cache-bump ritual
- Service worker generated (vite-plugin-pwa) instead of hand-maintained
- ESLint + Prettier, CI runs `npm test` on every push

## Phase 2 — Module-by-module extraction (one PR each, tests green after every step)

Suggested order (lowest coupling first):

1. `src/i18n.ts` — the LANG tables + `t()` (pure data, easiest win)
2. `src/lib/supabase.ts` — client + typed table helpers
3. `src/lib/pricing.ts` — RIDE_PRICES, close-out math (add unit tests here)
4. `src/auth/` — customer session, Google return, PIN gate
5. `src/booking/` — reserve flow, tickets, QR, My Rides
6. `src/staff/queue/` — bookings tab, check-in, scanner
7. `src/staff/pos/` — sales, receipts, refunds, close-out
8. `src/staff/inventory/`, `src/staff/analytics/`, the rest
9. Delete `app.py`, `schema.sql` once nothing references them

Each extraction: move code → type it → point index at the module → run suite → deploy.

## Phase 3 — Upgrades (only after the module is extracted)

- Supabase Realtime for queue + sessions (replaces polling)
- Component framework only if/where DOM code is painful (Preact is the cheap option)
- Per-module UX passes

## Standing risks / rules

- Never big-bang: every commit deployable, suite green
- The security rollout (SECURE_AUTH / RLS lockdown, see SECURITY-RUNBOOK.md) is still pending and should land **before** more customer PII features
- WebKit browser profile can be added to Playwright (`npx playwright install webkit`) for real iPhone coverage
