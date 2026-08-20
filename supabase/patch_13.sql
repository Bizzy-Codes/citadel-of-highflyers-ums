-- ============================================================
-- Citadel Highflyers UMS -- patch 13
-- Extends email_for_login_id() (patch_3) so students and teachers
-- can log in with their full name too, not just their display ID.
--
-- Display ID match still takes priority (exact, normalized, as
-- before). Name match only kicks in when the ID lookup finds
-- nothing, and only resolves when exactly one profile has that name
-- (case-insensitive, trimmed) -- if two people share a name, this
-- falls through to "no match" rather than guessing which one logged
-- in, so they'll need their ID instead.
-- ============================================================
create or replace function public.email_for_login_id(p_login_id text)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_email text;
  v_count int;
begin
  select email into v_email from public.profiles
  where regexp_replace(lower(display_id), '[^a-z0-9]', '', 'g')
      = regexp_replace(lower(p_login_id), '[^a-z0-9]', '', 'g')
  limit 1;

  if v_email is not null then
    return v_email;
  end if;

  select count(*), min(email) into v_count, v_email
  from public.profiles
  where lower(trim(name)) = lower(trim(p_login_id));

  if v_count = 1 then
    return v_email;
  end if;

  return null;
end;
$$;

grant execute on function public.email_for_login_id to anon, authenticated;
