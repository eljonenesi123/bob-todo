-- ========== BOB: task order, "she finished her day", note delivery status ==========
-- Run once in Supabase → SQL Editor. Safe to run again.

-- 1. Drag to reorder: each task remembers its place in the list
alter table public.tasks
  add column if not exists position int not null default 0;

-- 2. "She finished her day" push to Eljon, only if she turns it on herself
alter table public.profiles
  add column if not exists share_day_done boolean not null default false;
grant update (share_day_done) on public.profiles to authenticated;

-- 3. Honest delivery status for surprise notes
--    notified_at is now only set after a push really went out;
--    notify_error says why the last try failed (the server retries every 5 minutes)
alter table public.notes
  add column if not exists notify_error text;

-- Lets Eljon's Notes page show "She hasn't turned on notifications".
-- Returns how many devices a person has registered, but only to an admin or to that person.
create or replace function public.push_device_count(person uuid)
returns int language sql stable security definer set search_path = public
as $$
  select case
    when public.is_admin() or person = (select auth.uid())
      then (select count(*)::int from public.push_subscriptions where user_id = person)
    else null
  end
$$;
revoke all on function public.push_device_count(uuid) from public, anon;
grant execute on function public.push_device_count(uuid) to authenticated;
