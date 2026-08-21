-- ============================================================
-- Citadel Highflyers UMS -- patch 16
-- Adds email + intended class to admission applications, so that
-- admitting an applicant can create their student account directly
-- (name, email, and class are all it takes to call the same
-- account-creation path User Management uses) instead of the admin
-- having to separately go create the account by hand afterward.
-- ============================================================

alter table public.admission_applications add column if not exists email text;
alter table public.admission_applications add column if not exists class_applying_for text;
