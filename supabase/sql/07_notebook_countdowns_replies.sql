-- ========== BOB: notebook, countdowns and trips, replies to letters ==========
-- Run once in Supabase → SQL Editor, after 06. Safe to run again.
-- Everything is private to whoever made it, unless they share it with the other person (shared_with).

-- 1. Notebook: a page is free text ('note') or a list of things to tick ('list')
create table if not exists public.notebook_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  shared_with uuid references auth.users on delete set null,
  kind text not null default 'note' check (kind in ('note','list')),
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 20000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notebook_items (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.notebook_pages on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  done_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists notebook_items_page_idx on public.notebook_items (page_id);

-- updated_at moves only when the writing changes. The app uses it to notice
-- that a page was also edited on another device, instead of overwriting it.
create or replace function public.notebook_touch()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;
drop trigger if exists notebook_touch on public.notebook_pages;
create trigger notebook_touch before update on public.notebook_pages
  for each row execute function public.notebook_touch();

-- 2. Countdowns. For a trip, checkin_at is the time of day, the day before, of the
--    "do your online check-in" notification (null = no reminder)
create table if not exists public.countdowns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  shared_with uuid references auth.users on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  on_date date not null,
  is_trip boolean not null default false,
  checkin_at time,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists countdowns_date_idx on public.countdowns (on_date);

-- 3. Who can see and change what
alter table public.notebook_pages enable row level security;
alter table public.notebook_items enable row level security;
alter table public.countdowns enable row level security;

drop policy if exists "read own and shared pages" on public.notebook_pages;
drop policy if exists "add own pages" on public.notebook_pages;
drop policy if exists "edit own and shared pages" on public.notebook_pages;
drop policy if exists "delete own pages" on public.notebook_pages;
create policy "read own and shared pages" on public.notebook_pages for select to authenticated
  using ((select auth.uid()) in (user_id, shared_with));
create policy "add own pages" on public.notebook_pages for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "edit own and shared pages" on public.notebook_pages for update to authenticated
  using ((select auth.uid()) in (user_id, shared_with)) with check ((select auth.uid()) in (user_id, shared_with));
create policy "delete own pages" on public.notebook_pages for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "items of my pages" on public.notebook_items;
create policy "items of my pages" on public.notebook_items for all to authenticated
  using (exists (select 1 from public.notebook_pages p where p.id = page_id and (select auth.uid()) in (p.user_id, p.shared_with)))
  with check (exists (select 1 from public.notebook_pages p where p.id = page_id and (select auth.uid()) in (p.user_id, p.shared_with)));

drop policy if exists "read own and shared countdowns" on public.countdowns;
drop policy if exists "add own countdowns" on public.countdowns;
drop policy if exists "edit own and shared countdowns" on public.countdowns;
drop policy if exists "delete own countdowns" on public.countdowns;
create policy "read own and shared countdowns" on public.countdowns for select to authenticated
  using ((select auth.uid()) in (user_id, shared_with));
create policy "add own countdowns" on public.countdowns for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "edit own and shared countdowns" on public.countdowns for update to authenticated
  using ((select auth.uid()) in (user_id, shared_with)) with check ((select auth.uid()) in (user_id, shared_with));
create policy "delete own countdowns" on public.countdowns for delete to authenticated
  using ((select auth.uid()) = user_id);

-- The app may never change who owns a row. (Only the owner can stop sharing:
-- for the other person, the policies above require them to stay in shared_with.)
revoke all on public.notebook_pages, public.notebook_items, public.countdowns from anon, authenticated;
grant select, insert, delete on public.notebook_pages, public.notebook_items, public.countdowns to authenticated;
grant update (title, body, pinned, shared_with) on public.notebook_pages to authenticated;
grant update (title, done_at, position) on public.notebook_items to authenticated;
grant update (title, on_date, is_trip, checkin_at, checked_in_at, shared_with) on public.countdowns to authenticated;
grant all on public.notebook_pages, public.notebook_items, public.countdowns to service_role;

-- 4. Replies: a letter that answers another letter
alter table public.notes
  add column if not exists reply_to uuid references public.notes on delete set null;
alter table public.notes drop constraint if exists notes_kind_check;
alter table public.notes add constraint notes_kind_check check (kind in ('day_complete','surprise','reply'));

-- 5. Live sync between phone and PC
do $$
declare t text;
begin
  foreach t in array array['notebook_pages','notebook_items','countdowns'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Check: this should answer 3
select count(*) as new_tables from information_schema.tables
where table_schema = 'public' and table_name in ('notebook_pages','notebook_items','countdowns');
