-- ============================================================
-- Patch 1: run this once in the SQL Editor of the project you
-- already set up (you ran schema.sql + policies.sql before this
-- patch existed). Safe to run even if partially applied --
-- everything here is idempotent.
--
-- What it does:
--   1. Adds an `email` column to profiles (needed because login
--      is email-based now, and pages like Profile.tsx display it).
--   2. Updates the signup trigger to populate it.
--   3. Adds RLS policies so a TEACHER can promote a student in
--      their own class (update grade, archive results, write
--      history) -- the original policies.sql only allowed admins
--      to do this, which would have silently broken
--      ClassManagement.tsx's promote button for teachers.
-- ============================================================

alter table public.profiles add column if not exists email text;

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
    select 'CH ' || lpad((count(*) + 1)::text, 3, '0') into next_display_id
    from public.profiles where role = 'student';

    insert into public.profiles (id, display_id, name, role, grade, email)
    values (
      new.id, next_display_id,
      coalesce(new.raw_user_meta_data->>'name', 'New User'),
      'student', new.raw_user_meta_data->>'grade', new.email
    );
  else
    select 'CH-STAFF-' || lpad((count(*) + 1)::text, 2, '0') into next_display_id
    from public.profiles where role in ('teacher', 'admin', 'teacher_pending');

    insert into public.profiles (id, display_id, name, role, email)
    values (
      new.id, next_display_id,
      coalesce(new.raw_user_meta_data->>'name', 'New User'),
      'teacher_pending', new.email
    );
  end if;

  return new;
end;
$$;

-- Backfill email for any profiles created before this column existed
-- (your admin account, if you already created it in step 3 of README.md)
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

drop policy if exists "teachers update students in their class" on public.profiles;
create policy "teachers update students in their class"
  on public.profiles for update
  using (
    public.current_role() = 'teacher'
    and role = 'student'
    and grade = public.current_assigned_class()
  )
  with check (
    public.current_role() = 'teacher'
    and role = 'student'
  );

drop policy if exists "teachers delete results for their class" on public.results;
create policy "teachers delete results for their class"
  on public.results for delete
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.profiles p
      where p.id = student_id and p.grade = public.current_assigned_class()
    )
  );

drop policy if exists "teachers insert history for their class" on public.academic_history;
create policy "teachers insert history for their class"
  on public.academic_history for insert
  with check (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.profiles p
      where p.id = student_id and p.grade = public.current_assigned_class()
    )
  );
