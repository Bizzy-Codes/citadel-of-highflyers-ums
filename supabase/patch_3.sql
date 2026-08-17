-- ============================================================
-- Citadel Highflyers UMS -- patch 3
-- Lets students/teachers log in with their display ID (e.g. "CH 001",
-- "CH-STAFF-01") instead of only their email. Supabase's password
-- login only accepts an email, so the client resolves the typed ID to
-- an email via this function first, then signs in normally.
--
-- Comparison strips spaces/hyphens and ignores case so "CH001",
-- "ch 001", and "CH-001" all match the stored "CH 001".
--
-- Returns only the email for a single matching ID -- no other profile
-- data is exposed, and it's granted to anon since this runs pre-login.
-- ============================================================
create or replace function public.email_for_login_id(p_login_id text)
returns text
language sql stable security definer set search_path = public as $$
  select email from public.profiles
  where regexp_replace(lower(display_id), '[^a-z0-9]', '', 'g')
      = regexp_replace(lower(p_login_id), '[^a-z0-9]', '', 'g')
  limit 1;
$$;

grant execute on function public.email_for_login_id to anon, authenticated;
