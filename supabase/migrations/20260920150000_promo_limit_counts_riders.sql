-- ============================================================================
-- A promo code's limit counts RIDERS, and now says so.
--
-- NOT YET APPLIED. Run in the SQL editor, then:
--   supabase migration repair --status applied 20260920150000
--
-- Nothing about the behaviour changes: _promo_count has always fired per queue_entries row,
-- so a party of three on one code has always spent three of its uses. That is the rule the
-- owner confirmed on 2026-09-20 — a discount is given to a rider, so three riders is three
-- discounts. Only the words were wrong, and they were wrong in the two places a person looks
-- to find out what the number means. The analytics panel, which deduped to one per booking
-- and so reported a different figure from the admin table, is corrected in the client.
--
-- Comments only. No data, no policy, no function is touched.
-- ============================================================================

comment on column promo_codes.max_uses is
  'Total RIDERS that may ride on this code. A booking for three riders spends three. NULL = unlimited.';

comment on column promo_codes.uses is
  'Riders that have ridden on this code; maintained by trg_promo_count, one per queue_entries row. A code the price trigger refuses is cleared off the row first, so a refused discount is never counted.';

-- Check: both should mention riders.
-- select column_name, col_description('promo_codes'::regclass, ordinal_position)
--   from information_schema.columns
--  where table_name = 'promo_codes' and column_name in ('max_uses','uses');
