-- ========== BOB: lock a notebook group with a PIN ==========
-- Run once in Supabase → SQL Editor, after 09. Safe to run again.
-- The notes of a locked group are encrypted on the phone. The database only gets unreadable text,
-- and "lock" holds the group's key, itself encrypted with the PIN. The PIN is never stored anywhere.

alter table public.notebook_pages add column if not exists lock jsonb;
grant update (lock) on public.notebook_pages to authenticated;

-- Encrypted text is longer than the text itself
alter table public.notebook_items drop constraint if exists notebook_items_body_check;
alter table public.notebook_items add constraint notebook_items_body_check check (char_length(body) <= 120000);

-- A note encrypted with a key that's gone could never be opened again. So the database refuses to take
-- an encrypted note into a group without that very lock, and to drop a lock while notes still need it
-- (e.g. when one phone removes the lock and the other one hasn't heard of it yet).
create or replace function public.notebook_item_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare kid text;
begin
  if new.body like 'bob1:%' then
    select p.lock->>'kid' into kid from public.notebook_pages p where p.id = new.page_id for share;
    if kid is null or split_part(new.body, ':', 2) <> kid then
      raise exception 'This group has another lock';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists notebook_item_guard on public.notebook_items;
create trigger notebook_item_guard before insert or update on public.notebook_items
  for each row execute function public.notebook_item_guard();

create or replace function public.notebook_lock_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.lock is not null and (old.lock->>'kid') is distinct from (new.lock->>'kid') and exists (
    select 1 from public.notebook_items i where i.page_id = old.id and i.body like 'bob1:%') then
    raise exception 'Some notes still need this lock';
  end if;
  return new;
end;
$$;
drop trigger if exists notebook_lock_guard on public.notebook_pages;
create trigger notebook_lock_guard before update on public.notebook_pages
  for each row execute function public.notebook_lock_guard();
revoke all on function public.notebook_item_guard() from public, anon, authenticated;
revoke all on function public.notebook_lock_guard() from public, anon, authenticated;

-- Check: this should answer 1
select count(*) as lock_ready from information_schema.columns
where table_schema = 'public' and table_name = 'notebook_pages' and column_name = 'lock';
