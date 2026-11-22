-- ========== BOB step 1: initial schema (already applied in production) ==========
-- Kept here as a record. Later changes live in 02_, 03_, 04_ ... files.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  timezone text not null default 'Europe/Tirane',
  quiet_start time not null default '22:30',
  quiet_end time not null default '08:00',
  nudge_style text not null default 'sweet_hype',
  snoozed_on date,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  category text not null default 'personal'
    check (category in ('study','work','health','home','personal')),
  is_big3 boolean not null default false,
  repeat text not null default 'once'
    check (repeat in ('once','daily','weekdays','weekly')),
  remind_at time,
  due_on date default current_date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.task_completions (
  task_id uuid not null references public.tasks on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  done_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (task_id, done_on)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users on delete cascade,
  recipient_id uuid not null references auth.users on delete cascade,
  body text not null,
  kind text not null default 'day_complete' check (kind in ('day_complete','surprise')),
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users on delete cascade,
  recipient_id uuid not null references auth.users on delete cascade,
  title text not null,
  streak_required int not null check (streak_required > 0),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.notes enable row level security;
alter table public.rewards enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "own profile read" on public.profiles for select using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update using ((select auth.uid()) = id);
create policy "own tasks" on public.tasks for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own completions" on public.task_completions for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own push subs" on public.push_subscriptions for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "author manages notes" on public.notes for all
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "recipient reads notes" on public.notes for select using ((select auth.uid()) = recipient_id);
create policy "recipient opens notes" on public.notes for update using ((select auth.uid()) = recipient_id);
create policy "author manages rewards" on public.rewards for all
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "recipient reads rewards" on public.rewards for select using ((select auth.uid()) = recipient_id);
create policy "recipient claims rewards" on public.rewards for update using ((select auth.uid()) = recipient_id);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create index on public.tasks (user_id) where not archived;
create index on public.task_completions (user_id, done_on);
create index on public.notes (recipient_id);

-- Applied afterwards:
-- update public.profiles set role = 'admin', display_name = 'Eljon' where id = (select id from auth.users where email = '<eljon's email>');
alter publication supabase_realtime add table public.tasks, public.task_completions;
