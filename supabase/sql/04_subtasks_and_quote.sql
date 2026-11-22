-- ========== BOB: subtasks + daily quote time ==========

-- When the daily quote arrives (she can change it in Nudges)
alter table public.profiles
  add column if not exists quote_time time not null default '08:00';
grant update (quote_time) on public.profiles to authenticated;

-- Steps inside a bigger task (e.g. Assignment → reading, writing, editing)
create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  done_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.subtasks enable row level security;

create policy "own subtasks" on public.subtasks for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists subtasks_task_idx on public.subtasks (task_id);

-- Live sync between her phone and PC
alter publication supabase_realtime add table public.subtasks;
