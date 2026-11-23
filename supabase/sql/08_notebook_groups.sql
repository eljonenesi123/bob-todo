-- ========== BOB: the notebook becomes groups with notes inside ==========
-- Run once in Supabase → SQL Editor, after 07 and BEFORE pushing the app. Safe to run again.
-- A group is a row of notebook_pages, a note inside it is a row of notebook_items.

-- 1. A note has a name (title) and a text (body)
alter table public.notebook_items
  add column if not exists body text not null default '',
  add column if not exists updated_at timestamptz not null default now();
alter table public.notebook_items drop constraint if exists notebook_items_body_check;
alter table public.notebook_items add constraint notebook_items_body_check check (char_length(body) <= 20000);
grant update (body) on public.notebook_items to authenticated;

-- Same rule as for pages: updated_at moves when the writing changes, so an edit
-- made on another device is noticed instead of overwritten
drop trigger if exists notebook_touch on public.notebook_items;
create trigger notebook_touch before update on public.notebook_items
  for each row execute function public.notebook_touch();

-- 2. Pages written before become a group with that text as its first note. Nothing is lost.
insert into public.notebook_items (page_id, title, body)
  select id, left(coalesce(nullif(btrim(title), ''), 'Note'), 200), body
  from public.notebook_pages where kind = 'note' and btrim(body) <> '';
update public.notebook_pages set kind = 'list', body = '' where kind = 'note';
update public.notebook_pages set title = 'Untitled' where btrim(title) = '';

-- Check: this should answer 0
select count(*) as old_pages_left from public.notebook_pages where kind = 'note';
