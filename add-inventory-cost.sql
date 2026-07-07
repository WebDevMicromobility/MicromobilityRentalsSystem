-- Adds an optional cost-price column to inventory so Analytics can show gross margin.
-- Safe to run more than once. Cost is what YOU pay per unit; the app already tracks the
-- sell price. Until you fill in costs on items, the margin card simply stays hidden.
-- Run in the Supabase SQL editor.

alter table public.inventory
  add column if not exists cost numeric;
