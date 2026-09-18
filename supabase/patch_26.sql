-- ============================================================
-- Citadel Highflyers UMS -- patch 26
--
-- 1. Admins can delete a *declined* admission application (and its
--    uploaded photo/documents/receipt). Declined applications had no
--    way to be cleared out before -- they just piled up. Scoped to
--    status = 'declined' at the RLS layer, not just in the UI, so this
--    can never be used to erase a pending or already-admitted
--    application by accident or from a bug elsewhere in the app.
--
-- 2. Storage cleanup needs a delete policy on the admission-photos
--    bucket too -- patch_10 only ever granted insert and admin-select.
-- ============================================================

grant delete on public.admission_applications to authenticated;

drop policy if exists "admins delete declined applications" on public.admission_applications;
create policy "admins delete declined applications"
  on public.admission_applications for delete
  using (public.current_role() = 'admin' and status = 'declined');

drop policy if exists "admins delete admission photos" on storage.objects;
create policy "admins delete admission photos"
  on storage.objects for delete
  using (bucket_id = 'admission-photos' and public.current_role() = 'admin');
