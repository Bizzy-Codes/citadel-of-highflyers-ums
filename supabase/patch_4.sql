-- ============================================================
-- Citadel Highflyers UMS -- patch 4
-- Profile picture storage: a public "avatars" bucket, one file per
-- user at avatars/{user_id}/<filename>. Public so the image can be
-- shown anywhere in the UI via a plain URL; upload/replace/remove is
-- still restricted to the owning user (or an admin).
-- ============================================================

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar images are publicly readable" on storage.objects;
create policy "avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users replace their own avatar" on storage.objects;
create policy "users replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users remove their own avatar" on storage.objects;
create policy "users remove their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_role() = 'admin'
    )
  );
