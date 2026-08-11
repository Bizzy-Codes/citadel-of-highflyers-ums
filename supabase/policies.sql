-- ============================================================
-- Citadel Highflyers UMS -- Row Level Security policies
-- Run this AFTER schema.sql, in the same SQL Editor.
--
-- Design: no table grants anything to `anon` (unauthenticated
-- visitors get zero rows, closing the "type the admin URL and see
-- everyone's data" hole). Every real restriction happens per-row
-- via these policies, enforced by Postgres itself -- not by the
-- React app, so it can't be bypassed from the browser console.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.results enable row level security;
alter table public.academic_history enable row level security;
alter table public.class_subjects enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.notifications enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.results, public.academic_history,
  public.class_subjects, public.timetable_entries, public.notifications
  to authenticated;

-- ------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they bypass RLS
-- internally -- avoids the classic "policy on profiles queries
-- profiles" infinite recursion bug).
-- ------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_assigned_class()
returns text
language sql stable security definer set search_path = public
as $$
  select assigned_class from public.profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- profiles
-- No INSERT policy: rows are only ever created by the
-- handle_new_user trigger (runs as table owner, bypasses RLS),
-- so a client can never insert a profile with role='admin'.
-- ------------------------------------------------------------
create policy "view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "admins view all profiles"
  on public.profiles for select
  using (public.current_role() = 'admin');

create policy "teachers view students in their class"
  on public.profiles for select
  using (
    public.current_role() = 'teacher'
    and role = 'student'
    and grade = public.current_assigned_class()
  );

create policy "users update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "admins update any profile"
  on public.profiles for update
  using (public.current_role() = 'admin');

-- Teachers need to change a student's grade when promoting them.
-- USING checks the student is currently in the teacher's class;
-- WITH CHECK deliberately does NOT re-require that (the whole point
-- of promotion is the grade changes to a class the teacher doesn't
-- own) -- it only re-confirms the row is still a student, so a
-- teacher can't flip someone to admin via this path.
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

create policy "admins delete profiles"
  on public.profiles for delete
  using (public.current_role() = 'admin');

-- Field-level lock: even on their own row, non-admins cannot
-- change role, status, or display_id (e.g. self-promote to admin).
create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.current_role() <> 'admin' then
    new.role := old.role;
    new.status := old.status;
    new.display_id := old.display_id;
  end if;
  return new;
end;
$$;

create trigger enforce_profile_field_locks
  before update on public.profiles
  for each row execute function public.prevent_privilege_escalation();

-- ------------------------------------------------------------
-- results
-- ------------------------------------------------------------
create policy "students view own results"
  on public.results for select
  using (student_id = auth.uid());

create policy "teachers view results for their class"
  on public.results for select
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.profiles p
      where p.id = student_id and p.grade = public.current_assigned_class()
    )
  );

create policy "teachers insert results for their class"
  on public.results for insert
  with check (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.profiles p
      where p.id = student_id and p.grade = public.current_assigned_class()
    )
  );

create policy "teachers delete results for their class"
  on public.results for delete
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.profiles p
      where p.id = student_id and p.grade = public.current_assigned_class()
    )
  );

create policy "admins full access to results"
  on public.results for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- academic_history (written on promotion -- by admin or the
-- student's own teacher)
-- ------------------------------------------------------------
create policy "students view own history"
  on public.academic_history for select
  using (student_id = auth.uid());

create policy "teachers insert history for their class"
  on public.academic_history for insert
  with check (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.profiles p
      where p.id = student_id and p.grade = public.current_assigned_class()
    )
  );

create policy "admins full access to history"
  on public.academic_history for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- class_subjects / timetable_entries: any signed-in user can
-- read (needed for students/teachers to see their own class's
-- subjects and schedule); only admins write.
-- ------------------------------------------------------------
create policy "authenticated read class_subjects"
  on public.class_subjects for select
  using (auth.uid() is not null);

create policy "admins write class_subjects"
  on public.class_subjects for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "authenticated read timetable_entries"
  on public.timetable_entries for select
  using (auth.uid() is not null);

create policy "admins write timetable_entries"
  on public.timetable_entries for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- notifications: any signed-in user reads; admin/teacher post.
-- ------------------------------------------------------------
create policy "authenticated read notifications"
  on public.notifications for select
  using (auth.uid() is not null);

create policy "staff write notifications"
  on public.notifications for all
  using (public.current_role() in ('admin', 'teacher'))
  with check (public.current_role() in ('admin', 'teacher'));

-- ------------------------------------------------------------
-- Seed the default admin account's ROLE (the actual account itself
-- must be created via Auth, not SQL -- see supabase/README.md step 4)
-- ------------------------------------------------------------
