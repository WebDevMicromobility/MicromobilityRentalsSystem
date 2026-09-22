-- ============================================================================
-- queue_entries.removed_from: what a booking was before staff removed it (2026-09-22).
--
-- Removing a booking overwrites its status with 'removed', so History's Restore had to guess
-- what to bring it back as. It guessed from ride evidence alone, and a removed cancellation or
-- no-show came back as a live 'waiting' booking - taking a place on the night and its add-on
-- stock a second time. The staff client now writes the status the row had into this column
-- when it removes it (in a separate, tolerant update, so removal keeps working before this
-- column exists) and Restore reads it back.
--
-- Additive only: one nullable column and a CHECK on its values. No existing row changes; rows
-- removed before this lands keep NULL and Restore falls back to its evidence rules for them.
-- The queue_public view lists its columns explicitly, so nothing new reaches customers.
--
-- Rollback: alter table public.queue_entries drop constraint if exists queue_entries_removed_from_chk;
--           alter table public.queue_entries drop column if exists removed_from;
-- Idempotent.
-- ============================================================================

alter table public.queue_entries add column if not exists removed_from text;

alter table public.queue_entries drop constraint if exists queue_entries_removed_from_chk;
alter table public.queue_entries add constraint queue_entries_removed_from_chk
  check (removed_from is null or removed_from in ('waiting','waitlist','active','done','noshow','cancelled'));
