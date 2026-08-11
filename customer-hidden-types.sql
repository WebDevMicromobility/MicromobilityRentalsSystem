-- Per-customer hidden bike types (staff-set in the customer editor).
-- Comma list, e.g. 'Road Carbon,Mountain': those types disappear from THAT customer's
-- booking type picker. NULL = nothing hidden. Staff pickers are never filtered.
alter table customers add column if not exists hidden_types text;
