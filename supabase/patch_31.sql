-- ============================================================
-- Citadel Highflyers UMS -- patch 31
--
-- Siblings can share one parent email.
--
-- A parent with three children had to invent two extra email
-- addresses, because Supabase auth insists every account's email is
-- unique. Pupils never actually type their email -- they log in by
-- name or "CH 001" -- so the email is only a contact address for the
-- school (and future bulk email/SMS to families).
--
-- The split:
--   * auth.users.email     -- the LOGIN address. Still unique. For the
--                              first child it IS the parent's email; for
--                              a sibling the app makes a plus-address of
--                              it (mum+ch4k2x9a@gmail.com), which Gmail
--                              and most providers still deliver to mum.
--   * profiles.email       -- the CONTACT address. The real one the
--                              parent typed, repeated across siblings.
--                              Passed in as user_metadata.contact_email.
--
-- Because the two can now differ, the login lookup must hand back the
-- auth address, not profiles.email -- otherwise a sibling's login would
-- resolve to the first child's address and the password check would
-- run against the wrong account.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New accounts store the contact email on the profile
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  next_display_id text;
  -- The address the family actually uses; falls back to the login
  -- address for anyone signed up without one (i.e. everyone before
  -- this patch, and every non-sibling).
  contact_email text := coalesce(nullif(trim(new.raw_user_meta_data->>'contact_email'), ''), new.email);
begin
  if requested_role not in ('student', 'teacher') then
    requested_role := 'student';
  end if;

  if requested_role = 'student' then
    select 'CH ' || lpad((coalesce(max(substring(display_id from '\d+$')::int), 0) + 1)::text, 3, '0')
    into next_display_id
    from public.profiles where role = 'student';

    insert into public.profiles (id, display_id, name, role, grade, email)
    values (
      new.id,
      next_display_id,
      coalesce(new.raw_user_meta_data->>'name', 'New User'),
      'student',
      new.raw_user_meta_data->>'grade',
      contact_email
    );
  else
    select 'CH-STAFF-' || lpad((coalesce(max(substring(display_id from '\d+$')::int), 0) + 1)::text, 2, '0')
    into next_display_id
    from public.profiles where role in ('teacher', 'admin', 'teacher_pending');

    insert into public.profiles (id, display_id, name, role, email)
    values (
      new.id,
      next_display_id,
      coalesce(new.raw_user_meta_data->>'name', 'New User'),
      'teacher_pending',
      contact_email
    );
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. Login lookup returns the auth (login) address
-- ------------------------------------------------------------
-- Same matching rules as patch_24; only what it returns changes. It
-- finds the profile, then reads that account's own address from
-- auth.users.
create or replace function public.email_for_login_id(p_login_id text)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid;
  v_ids uuid[];
  -- "  Martins   Oge  " -> "martins oge"
  v_needle text := lower(trim(regexp_replace(coalesce(p_login_id, ''), '\s+', ' ', 'g')));
  -- "CH 001" / "ch-001" -> "ch001"
  v_squashed text := regexp_replace(lower(coalesce(p_login_id, '')), '[^a-z0-9]', '', 'g');
begin
  if v_needle = '' then
    return null;
  end if;

  -- Login ID, ignoring case, spacing and punctuation.
  select id into v_id from public.profiles
  where regexp_replace(lower(display_id), '[^a-z0-9]', '', 'g') = v_squashed
  limit 1;

  -- Full name, ignoring case and collapsing runs of whitespace.
  if v_id is null then
    select array_agg(id) into v_ids from public.profiles
    where lower(trim(regexp_replace(name, '\s+', ' ', 'g'))) = v_needle;
    if cardinality(v_ids) = 1 then v_id := v_ids[1]; end if;
  end if;

  -- Last resort: ignore spacing and punctuation entirely. Still
  -- refuses when it's ambiguous.
  if v_id is null then
    select array_agg(id) into v_ids from public.profiles
    where regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = v_squashed;
    if cardinality(v_ids) = 1 then v_id := v_ids[1]; end if;
  end if;

  if v_id is null then
    return null;
  end if;

  return (select email from auth.users where id = v_id);
end;
$$;
grant execute on function public.email_for_login_id to anon, authenticated;
