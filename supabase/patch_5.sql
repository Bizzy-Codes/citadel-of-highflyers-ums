-- ============================================================
-- Citadel Highflyers UMS -- patch 5
-- Assignments: teachers post an assignment (optionally with an
-- attached brief file) to their class; students upload a submission
-- file; teachers grade it. Files live in a PRIVATE "assignment-files"
-- bucket (unlike avatars) since schoolwork shouldn't be publicly
-- readable -- the app fetches short-lived signed URLs to download.
-- ============================================================

create or replace function public.current_grade()
returns text
language sql stable security definer set search_path = public
as $$
  select grade from public.profiles where id = auth.uid();
$$;

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  subject text not null,
  title text not null,
  description text,
  due_date date,
  attachment_path text,
  attachment_name text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  submitted_at timestamptz not null default now(),
  grade text,
  feedback text,
  unique (assignment_id, student_id)
);

alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
grant select, insert, update, delete on public.assignments, public.assignment_submissions to authenticated;

-- ------------------------------------------------------------
-- assignments
-- ------------------------------------------------------------
drop policy if exists "students view assignments for their class" on public.assignments;
create policy "students view assignments for their class"
  on public.assignments for select
  using (public.current_role() = 'student' and class_name = public.current_grade());

drop policy if exists "teachers manage assignments for their class" on public.assignments;
create policy "teachers manage assignments for their class"
  on public.assignments for all
  using (public.current_role() = 'teacher' and class_name = public.current_assigned_class())
  with check (public.current_role() = 'teacher' and class_name = public.current_assigned_class());

drop policy if exists "admins full access to assignments" on public.assignments;
create policy "admins full access to assignments"
  on public.assignments for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- assignment_submissions
-- ------------------------------------------------------------
drop policy if exists "students view own submissions" on public.assignment_submissions;
create policy "students view own submissions"
  on public.assignment_submissions for select
  using (student_id = auth.uid());

drop policy if exists "students submit their own work" on public.assignment_submissions;
create policy "students submit their own work"
  on public.assignment_submissions for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_id and a.class_name = public.current_grade()
    )
  );

drop policy if exists "students delete own ungraded submission" on public.assignment_submissions;
create policy "students delete own ungraded submission"
  on public.assignment_submissions for delete
  using (student_id = auth.uid() and grade is null);

drop policy if exists "teachers view submissions for their class" on public.assignment_submissions;
create policy "teachers view submissions for their class"
  on public.assignment_submissions for select
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_id and a.class_name = public.current_assigned_class()
    )
  );

drop policy if exists "teachers grade submissions for their class" on public.assignment_submissions;
create policy "teachers grade submissions for their class"
  on public.assignment_submissions for update
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_id and a.class_name = public.current_assigned_class()
    )
  );

drop policy if exists "admins full access to assignment_submissions" on public.assignment_submissions;
create policy "admins full access to assignment_submissions"
  on public.assignment_submissions for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- Storage: private bucket, path convention
--   {assignment_id}/brief/<filename>                 -- teacher's attachment
--   {assignment_id}/submissions/{student_id}/<file>  -- student's upload
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('assignment-files', 'assignment-files', false)
on conflict (id) do nothing;

drop policy if exists "teachers read assignment files for their class" on storage.objects;
create policy "teachers read assignment files for their class"
  on storage.objects for select
  using (
    bucket_id = 'assignment-files'
    and public.current_role() = 'teacher'
    and exists (
      select 1 from public.assignments a
      where a.id::text = (storage.foldername(name))[1]
        and a.class_name = public.current_assigned_class()
    )
  );

drop policy if exists "students read own class assignment files" on storage.objects;
create policy "students read own class assignment files"
  on storage.objects for select
  using (
    bucket_id = 'assignment-files'
    and public.current_role() = 'student'
    and (
      (storage.foldername(name))[2] = 'brief'
      or (storage.foldername(name))[3] = auth.uid()::text
    )
    and exists (
      select 1 from public.assignments a
      where a.id::text = (storage.foldername(name))[1]
        and a.class_name = public.current_grade()
    )
  );

drop policy if exists "teachers upload assignment briefs" on storage.objects;
create policy "teachers upload assignment briefs"
  on storage.objects for insert
  with check (
    bucket_id = 'assignment-files'
    and public.current_role() = 'teacher'
    and (storage.foldername(name))[2] = 'brief'
    and exists (
      select 1 from public.assignments a
      where a.id::text = (storage.foldername(name))[1]
        and a.class_name = public.current_assigned_class()
    )
  );

drop policy if exists "teachers replace assignment briefs" on storage.objects;
create policy "teachers replace assignment briefs"
  on storage.objects for update
  using (
    bucket_id = 'assignment-files'
    and public.current_role() = 'teacher'
    and (storage.foldername(name))[2] = 'brief'
    and exists (
      select 1 from public.assignments a
      where a.id::text = (storage.foldername(name))[1]
        and a.class_name = public.current_assigned_class()
    )
  );

drop policy if exists "teachers delete assignment briefs" on storage.objects;
create policy "teachers delete assignment briefs"
  on storage.objects for delete
  using (
    bucket_id = 'assignment-files'
    and (
      public.current_role() = 'admin'
      or (
        public.current_role() = 'teacher'
        and (storage.foldername(name))[2] = 'brief'
        and exists (
          select 1 from public.assignments a
          where a.id::text = (storage.foldername(name))[1]
            and a.class_name = public.current_assigned_class()
        )
      )
    )
  );

drop policy if exists "students upload own submission files" on storage.objects;
create policy "students upload own submission files"
  on storage.objects for insert
  with check (
    bucket_id = 'assignment-files'
    and public.current_role() = 'student'
    and (storage.foldername(name))[2] = 'submissions'
    and (storage.foldername(name))[3] = auth.uid()::text
    and exists (
      select 1 from public.assignments a
      where a.id::text = (storage.foldername(name))[1]
        and a.class_name = public.current_grade()
    )
  );

drop policy if exists "students replace own submission files" on storage.objects;
create policy "students replace own submission files"
  on storage.objects for update
  using (
    bucket_id = 'assignment-files'
    and public.current_role() = 'student'
    and (storage.foldername(name))[2] = 'submissions'
    and (storage.foldername(name))[3] = auth.uid()::text
  );

drop policy if exists "students delete own submission files" on storage.objects;
create policy "students delete own submission files"
  on storage.objects for delete
  using (
    bucket_id = 'assignment-files'
    and (
      public.current_role() = 'admin'
      or (
        public.current_role() = 'student'
        and (storage.foldername(name))[2] = 'submissions'
        and (storage.foldername(name))[3] = auth.uid()::text
      )
    )
  );
