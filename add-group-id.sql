-- Staff "Add group": riders added together share a group_id so the roster shows them
-- as one group even when they have different customer accounts (or none at all).
-- The app only sends group_id when set, so running the app before this migration is safe
-- (same pattern as the approval column). Run in the Supabase SQL editor.
alter table queue_entries add column if not exists group_id text;

-- JCC "Add group": one display name for the whole party (e.g. "Tamer Group"), shown on the
-- roster group block; unnamed riders fall back to "<group name> 1/2/3…".
alter table queue_entries add column if not exists group_name text;

-- Who the group's main phone number belongs to (shown next to the phone on the roster).
alter table queue_entries add column if not exists group_contact text;

-- The responsible person's own number (kept even when every rider has their own phone).
alter table queue_entries add column if not exists group_phone text;
