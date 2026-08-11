-- Staff "Add group": riders added together share a group_id so the roster shows them
-- as one group even when they have different customer accounts (or none at all).
-- The app only sends group_id when set, so running the app before this migration is safe
-- (same pattern as the approval column). Run in the Supabase SQL editor.
alter table queue_entries add column if not exists group_id text;
