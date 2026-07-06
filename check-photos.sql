-- Check whether any photos are stored as heavy base64 blobs INSIDE the table rows
-- (they predate the Storage bucket). Base64 photos get re-downloaded on every data load;
-- Storage-URL photos are tiny. Read-only. Run in the Supabase SQL editor and share the
-- result. If base64_size is large (several MB), migrating them to Storage is worth it.

select 'bikes' as tbl,
       count(*) filter (where photo like 'data:%')  as base64_photos,
       count(*) filter (where photo like 'http%')    as url_photos,
       coalesce(pg_size_pretty(sum(length(photo)) filter (where photo like 'data:%')), '0') as base64_size
from bikes
union all
select 'inventory',
       count(*) filter (where photo like 'data:%'),
       count(*) filter (where photo like 'http%'),
       coalesce(pg_size_pretty(sum(length(photo)) filter (where photo like 'data:%')), '0')
from inventory
union all
select 'customers',
       count(*) filter (where photo like 'data:%'),
       count(*) filter (where photo like 'http%'),
       coalesce(pg_size_pretty(sum(length(photo)) filter (where photo like 'data:%')), '0')
from customers;
