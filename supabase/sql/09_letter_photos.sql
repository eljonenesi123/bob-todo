-- ========== BOB: a photo in a letter ==========
-- Run once in Supabase → SQL Editor, after 08. Safe to run again.

-- 1. A letter can have one photo: its place in the private storage below
alter table public.notes add column if not exists photo_path text;

-- 2. Private storage for the photos (JPEG only, 3 MB at most; the app makes them small before sending)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('letter-photos', 'letter-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3. Who can do what. Every photo lies in a folder named after whoever wrote the letter.
drop policy if exists "add own letter photos" on storage.objects;
create policy "add own letter photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'letter-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "delete own letter photos" on storage.objects;
create policy "delete own letter photos" on storage.objects for delete to authenticated
  using (bucket_id = 'letter-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- You see your own photos, and the ones in letters you can read. The rules of "notes" apply inside
-- this check too, so the photo of a surprise stays hidden until the surprise arrives.
drop policy if exists "see photos of my letters" on storage.objects;
create policy "see photos of my letters" on storage.objects for select to authenticated
  using (bucket_id = 'letter-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.notes n
      where n.photo_path = objects.name
        and n.recipient_id = (select auth.uid())
        and n.author_id::text = (storage.foldername(objects.name))[1]
    )
  ));

-- Check: this should answer 1
select count(*) as photo_storage from storage.buckets where id = 'letter-photos' and not public;
