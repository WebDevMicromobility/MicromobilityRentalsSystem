# Database SQL — layout and rules

The repo root no longer holds loose `.sql` files. Layout:

- `sql/supabase_schema.sql` — full table schema (reference; used to bootstrap a fresh project).
- `sql/new-project-setup.sql` — one-shot setup for a brand-new Supabase project.
- `sql/applied/` — **historical record** of one-off migrations that were run by hand in the
  SQL editor against production. These are frozen: never re-run, never edit. They exist so
  the current production state can be reconstructed and audited.
- `sql/rollbacks/` — ⛔ scripts that UNDO safety measures (e.g. `disable-privacy-lockdown.sql`
  re-opens RLS). Kept for emergencies only. Never run against production without a second
  person confirming.
- `supabase/migrations/` — **the only place new schema changes go from now on.** See its
  README for the workflow.

## The rule going forward

Hand-pasting SQL into the dashboard editor is how the `sql/applied/` pile happened: no order,
no record of what ran when, no way to reproduce prod. From now on every schema change is a
timestamped migration file created with the Supabase CLI and committed in the same PR as the
app change that needs it. The dashboard SQL editor is for reading, not writing.
