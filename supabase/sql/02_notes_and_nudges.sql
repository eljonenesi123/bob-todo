-- ========== BOB step 6: notes, rewards, nudges ==========

-- Surprise notes get a delivery time; we remember what was already pushed
alter table public.notes
  add column if not exists deliver_at timestamptz,
  add column if not exists notified_at timestamptz;
alter table public.rewards
  add column if not exists notified_at timestamptz;

-- Which nudge went to whom on which day (prevents duplicates). Only the server reads it.
create table if not exists public.nudge_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  ref text not null default '',
  sent_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref, sent_on)
);
alter table public.nudge_log enable row level security;  -- no policies = app users can't touch it

-- Admin helper
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin') $$;

-- Eljon (admin) can see who's signed up, to write notes to her
create policy "admin reads profiles" on public.profiles for select
  using (public.is_admin());

-- She can see the name of whoever writes her notes
create policy "read note authors" on public.profiles for select
  using (exists (select 1 from public.notes n where n.author_id = profiles.id and n.recipient_id = (select auth.uid())));

-- Surprise notes stay hidden until their delivery time
drop policy if exists "recipient reads notes" on public.notes;
create policy "recipient reads notes" on public.notes for select
  using ((select auth.uid()) = recipient_id and (deliver_at is null or deliver_at <= now()));

-- Security: users may edit their settings, but never their own role
revoke update on public.profiles from authenticated;
grant update (display_name, timezone, quiet_start, quiet_end, nudge_style, snoozed_on)
  on public.profiles to authenticated;

-- She may only mark notes opened / rewards claimed, not rewrite them
revoke update on public.notes from authenticated;
grant update (opened_at) on public.notes to authenticated;
revoke update on public.rewards from authenticated;
grant update (claimed_at) on public.rewards to authenticated;
-- (Eljon edits by deleting + re-adding, which his "author manages" policies allow)
