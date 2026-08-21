-- ============================================================
-- Citadel Highflyers UMS -- patch 15
-- Fixes "Database error saving new user" on signup (self-registered
-- AND admin-created accounts alike, since both insert into auth.users
-- and fire this same trigger).
--
-- handle_new_user() picked the next display_id as count(*) + 1. That
-- works only as long as nobody is ever deleted. The moment one row is
-- deleted (e.g. a test account), the count permanently undercounts
-- the highest ID actually in use, so the "next" ID it computes
-- collides with an existing one -- violating profiles.display_id's
-- unique constraint and failing the whole signup with a generic
-- Postgres error. Deriving the next ID from the highest numeric
-- suffix actually in use (not the row count) is immune to gaps left
-- by deletions.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  next_display_id text;
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
      new.email
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
      new.email
    );
  end if;

  return new;
end;
$$;
