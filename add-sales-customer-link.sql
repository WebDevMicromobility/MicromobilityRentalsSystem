-- Link Sales receipts to customer accounts (the app auto-detects the column).
alter table cashier_sales add column if not exists customer_id text;
