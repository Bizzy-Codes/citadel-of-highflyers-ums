-- ============================================================
-- Citadel Highflyers UMS -- patch 8
-- File/image attachments for private messaging. A private
-- "chat-files" bucket, path convention:
--   {sender_id}/{recipient_id}/<timestamp>-<filename>
-- Both participants are encoded directly in the path, so storage
-- policies can check access without joining back to
-- direct_messages -- same "no join needed" simplicity as the
-- avatars bucket, but private since a chat attachment shouldn't be
-- publicly linkable like a profile photo is.
-- ============================================================

alter table public.direct_messages add column if not exists attachment_path text;
alter table public.direct_messages add column if not exists attachment_name text;

-- content was `not null check (char_length between 1 and 4000)` --
-- an attachment-only message still needs non-empty content, so the
-- client fills in a fallback caption (e.g. the file name) rather
-- than this constraint being relaxed.

insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', false)
on conflict (id) do nothing;

drop policy if exists "chat participants read attachment" on storage.objects;
create policy "chat participants read attachment"
  on storage.objects for select
  using (
    bucket_id = 'chat-files'
    and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2])
  );

drop policy if exists "senders upload chat attachments" on storage.objects;
create policy "senders upload chat attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "senders delete own chat attachments" on storage.objects;
create policy "senders delete own chat attachments"
  on storage.objects for delete
  using (
    bucket_id = 'chat-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
