-- ========== BOB: both accounts get the same features ==========
-- Run once in Supabase → SQL Editor, after 05. Safe to run again.
-- Bob has exactly two accounts and sign-ups are closed, so "anyone signed in" means "the two of you".
-- If sign-ups are ever opened again, tighten these two rules first.

-- 1. Each of you can see the other's profile (name, to write notes and say who a note is from)
drop policy if exists "admin reads profiles" on public.profiles;
drop policy if exists "partners read profiles" on public.profiles;
create policy "partners read profiles" on public.profiles for select to authenticated
  using ((select auth.uid()) is not null);

-- 2. Each of you can see whether the other has notifications turned on (a count, never the device details)
create or replace function public.push_device_count(person uuid)
returns int language sql stable security definer set search_path = public
as $$
  select case
    when (select auth.uid()) is not null
      then (select count(*)::int from public.push_subscriptions where user_id = person)
    else null
  end
$$;
revoke all on function public.push_device_count(uuid) from public, anon;
grant execute on function public.push_device_count(uuid) to authenticated;

-- Writing notes and rewards was already allowed for every account ("author manages notes/rewards");
-- only the app hid it. Nothing else to change.
