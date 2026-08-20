-- ============================================================
-- Citadel Highflyers UMS -- patch 11
-- Adds a real `location` column to profiles -- the Profile page was
-- previously showing a hardcoded fake address ("45 Citadel Heights,
-- Plateau State, Nigeria") for every single user, with no way to
-- edit it, since the field didn't exist in the schema at all.
-- ============================================================

alter table public.profiles add column if not exists location text;
