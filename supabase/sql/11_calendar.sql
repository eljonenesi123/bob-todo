-- ========== BOB: calendar ==========
-- Run once in Supabase → SQL Editor, after 10. Safe to run again.
-- Entries with their own days: standby weeks, shifts, birthdays, appointments.
-- Private to whoever made them, unless shared. A shared entry can be seen by the other person, not changed.

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  shared_with uuid references auth.users on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  -- The first time it happens. Later ones keep the same length.
  starts_on date not null,
  ends_on date not null,
  at_time time,
  -- 'weeks' = every `every` weeks; 'month_date' = on the 7th; 'month_weekday' = on the first Monday
  repeat text not null default 'never' check (repeat in ('never','weeks','month_date','month_weekday','year')),
  every smallint not null default 1 check (every between 1 and 12),
  until date, -- none starts after this day
  skipped date[] not null default '{}', -- starts that don't happen (skipped or moved)
  -- Reminders: how many days before it starts, all at the same time of day
  remind_days smallint[] not null default '{1}' check (remind_days <@ array[0,1,2,7]::smallint[]),
  remind_at time not null default '18:00',
  remind_partner boolean not null default false,
  remind_from timestamptz not null default now(), -- set below; older reminder times are never sent
  highlight boolean not null default false,
  -- "Change only this one" makes a copy that takes the place of one start of another entry
  moved_from uuid references public.calendar_entries on delete set null,
  moved_day date,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 366),
  check (until is null or until >= starts_on)
);
create index if not exists calendar_entries_user_idx on public.calendar_entries (user_id);
create index if not exists calendar_entries_shared_idx on public.calendar_entries (shared_with);

-- Only reminders from now on: writing an entry down tonight must not send yesterday's reminder
create or replace function public.calendar_remind_from()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.remind_from := now();
  elsif (new.starts_on, new.repeat, new.every, new.until, new.remind_days, new.remind_at, new.remind_partner, new.shared_with)
     is distinct from (old.starts_on, old.repeat, old.every, old.until, old.remind_days, old.remind_at, old.remind_partner, old.shared_with) then
    new.remind_from := now();
  else
    new.remind_from := old.remind_from;
  end if;
  return new;
end;
$$;
drop trigger if exists calendar_remind_from on public.calendar_entries;
create trigger calendar_remind_from before insert or update on public.calendar_entries
  for each row execute function public.calendar_remind_from();

-- The copy and the gap it leaves are saved together, so one can't exist without the other
create or replace function public.calendar_take_place()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.moved_from is not null and new.moved_day is not null then
    update public.calendar_entries set skipped = array_append(skipped, new.moved_day)
    where id = new.moved_from and not (new.moved_day = any (skipped));
  end if;
  return null;
end;
$$;
drop trigger if exists calendar_take_place on public.calendar_entries;
create trigger calendar_take_place after insert on public.calendar_entries
  for each row execute function public.calendar_take_place();

-- Who can see and change what
alter table public.calendar_entries enable row level security;
drop policy if exists "read own and shared entries" on public.calendar_entries;
drop policy if exists "add own entries" on public.calendar_entries;
drop policy if exists "edit own entries" on public.calendar_entries;
drop policy if exists "delete own entries" on public.calendar_entries;
create policy "read own and shared entries" on public.calendar_entries for select to authenticated
  using ((select auth.uid()) in (user_id, shared_with));
create policy "add own entries" on public.calendar_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "edit own entries" on public.calendar_entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own entries" on public.calendar_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.calendar_entries from anon, authenticated;
grant select, insert, delete on public.calendar_entries to authenticated;
grant update (title, starts_on, ends_on, at_time, repeat, every, until, skipped, remind_days, remind_at, remind_partner, highlight, shared_with)
  on public.calendar_entries to authenticated;
grant all on public.calendar_entries to service_role;

-- Live sync between phone and PC
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_entries') then
    alter publication supabase_realtime add table public.calendar_entries;
  end if;
end $$;

-- Check: this should answer 1
select count(*) as new_tables from information_schema.tables
where table_schema = 'public' and table_name = 'calendar_entries';
