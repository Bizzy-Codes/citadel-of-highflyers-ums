-- ============================================================
-- Citadel Highflyers UMS -- patch 19
-- Repair patch for the "Could not find the 'location' column of
-- 'profiles' in the schema cache" error when saving any profile.
--
-- Three profiles columns were added by later patches rather than by
-- schema.sql (email in patch_1, avatar_url in patch_4, location in
-- patch_11). If any of those patches was skipped, every profile save
-- fails -- the app always sends `location`, so a missing column takes
-- down saving name/phone/class/status along with it.
--
-- This re-asserts all three (each is a no-op if already present) and
-- then tells PostgREST to reload, which also fixes the case where the
-- column does exist but the API's schema cache is stale.
-- ============================================================

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists location text;

notify pgrst, 'reload schema';
