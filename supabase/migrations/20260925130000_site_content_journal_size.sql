-- The Journal keeps every article in one site_content row (journal.posts.items), and the 20 KB
-- cap on a row stopped the save after two or three normal-length bilingual articles (an Arabic
-- character is two bytes). Journal rows may now hold 150 KB; every other key keeps 20 KB. Not
-- more: site_content_history stores the old and the new value of every save.
alter table public.site_content drop constraint if exists site_content_value_size;
alter table public.site_content add constraint site_content_value_size
  check (octet_length(value::text) <= case when key like 'journal.%' then 150000 else 20000 end);
