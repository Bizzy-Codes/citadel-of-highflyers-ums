-- ============================================================
-- Citadel Highflyers UMS -- patch 24
--
-- 1. Logging in by name works again.
--
--    This was reported as a capital-letters problem. It isn't -- the
--    lookup already lowercases both sides. The real fault is stray
--    whitespace in the stored names:
--
--      email_for_login_id('Martins Oge Prosper')   -> null
--      email_for_login_id('Martins  Oge Prosper')  -> found
--
--    The profile is stored with a DOUBLE space, and nobody types a
--    double space. trim() doesn't help -- it only strips the ends.
--    Eight accounts on this database are affected; four of them have
--    internal double spaces and simply cannot be logged into by name.
--
--    Fixed on both sides: runs of whitespace are collapsed before
--    comparing, and the stored names are tidied up.
--
-- 2. Applications can carry supporting documents (birth certificate,
--    immunisation record, anything else the family wants to attach).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Whitespace-tolerant login lookup
-- ------------------------------------------------------------
create or replace function public.email_for_login_id(p_login_id text)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_email text;
  v_count int;
  -- "  Martins   Oge  " -> "martins oge"
  v_needle text := lower(trim(regexp_replace(coalesce(p_login_id, ''), '\s+', ' ', 'g')));
  -- "CH 001" / "ch-001" -> "ch001"
  v_squashed text := regexp_replace(lower(coalesce(p_login_id, '')), '[^a-z0-9]', '', 'g');
begin
  if v_needle = '' then
    return null;
  end if;

  -- Login ID, ignoring case, spacing and punctuation.
  select email into v_email from public.profiles
  where regexp_replace(lower(display_id), '[^a-z0-9]', '', 'g') = v_squashed
  limit 1;
  if v_email is not null then
    return v_email;
  end if;

  -- Full name, ignoring case and collapsing runs of whitespace.
  select count(*), min(email) into v_count, v_email
  from public.profiles
  where lower(trim(regexp_replace(name, '\s+', ' ', 'g'))) = v_needle;
  if v_count = 1 then
    return v_email;
  end if;

  -- Last resort: ignore spacing and punctuation entirely, so
  -- "ariellaakanimoeffiong" or a hyphenated name typed without the
  -- hyphen still resolves. Still refuses when it's ambiguous.
  select count(*), min(email) into v_count, v_email
  from public.profiles
  where regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = v_squashed;
  if v_count = 1 then
    return v_email;
  end if;

  return null;
end;
$$;
grant execute on function public.email_for_login_id to anon, authenticated;

-- Tidy the stored names too, so they also *display* correctly.
-- (Runs as the SQL owner, so the profiles self-update guard added in
-- patch_22 lets it through -- that guard only applies to a signed-in
-- user editing their own row.)
update public.profiles
set name = trim(regexp_replace(name, '\s+', ' ', 'g'))
where name <> trim(regexp_replace(name, '\s+', ' ', 'g'));

-- ------------------------------------------------------------
-- 2. Supporting documents on an admission application
--
-- Stored as a jsonb array of { path, name } rather than a side table:
-- the files are uploaded to storage under the application's own id
-- before the row is inserted, so they travel in with the insert the
-- anon applicant is already allowed to make -- no extra policy, no
-- second round trip, nothing to clean up if they abandon the form.
-- ------------------------------------------------------------
alter table public.admission_applications
  add column if not exists documents jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
