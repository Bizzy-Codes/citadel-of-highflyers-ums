-- ============================================================
-- Citadel Highflyers UMS -- patch 14
-- Attendance register + academic calendar settings.
--
-- Teachers mark daily present/absent/late for their own class's
-- pupils via plain RLS-scoped inserts/updates (same pattern as
-- assignment grading -- no bespoke RPC needed here, since attendance
-- doesn't need server-trusted timing the way exam attempts do).
-- Students see only their own records; week numbers are derived
-- client-side from academic_calendar.term_start_date rather than
-- stored, so changing total_weeks/start_date later never desyncs
-- already-marked days.
--
-- academic_calendar is a single-row settings table the admin edits
-- (term name, total weeks, start date, and an optional uploaded
-- calendar document -- image or PDF -- for when the school already
-- has a typed calendar rather than wanting it rebuilt in the UI).
-- ============================================================

create table if not exists public.academic_calendar (
  id int primary key default 1,
  term text not null default '1st Term',
  total_weeks int not null default 13 check (total_weeks > 0 and total_weeks <= 20),
  term_start_date date,
  document_path text,
  document_name text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint academic_calendar_singleton check (id = 1)
);

insert into public.academic_calendar (id) values (1) on conflict (id) do nothing;

alter table public.academic_calendar enable row level security;
grant select, update on public.academic_calendar to authenticated;

drop policy if exists "everyone reads the academic calendar" on public.academic_calendar;
create policy "everyone reads the academic calendar"
  on public.academic_calendar for select
  using (true);

drop policy if exists "admins update the academic calendar" on public.academic_calendar;
create policy "admins update the academic calendar"
  on public.academic_calendar for update
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- Attendance records -- one row per pupil per day.
-- ------------------------------------------------------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create index if not exists attendance_records_class_date_idx on public.attendance_records (class_name, attendance_date);
create index if not exists attendance_records_student_idx on public.attendance_records (student_id, attendance_date);

alter table public.attendance_records enable row level security;
grant select, insert, update on public.attendance_records to authenticated;

drop policy if exists "students view own attendance" on public.attendance_records;
create policy "students view own attendance"
  on public.attendance_records for select
  using (student_id = auth.uid());

drop policy if exists "teachers view attendance for their class" on public.attendance_records;
create policy "teachers view attendance for their class"
  on public.attendance_records for select
  using (public.current_role() = 'teacher' and class_name = public.current_assigned_class());

drop policy if exists "admins view all attendance" on public.attendance_records;
create policy "admins view all attendance"
  on public.attendance_records for select
  using (public.current_role() = 'admin');

drop policy if exists "teachers mark attendance for their class" on public.attendance_records;
create policy "teachers mark attendance for their class"
  on public.attendance_records for insert
  with check (
    public.current_role() = 'teacher'
    and class_name = public.current_assigned_class()
    and marked_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student' and p.grade = class_name)
  );

drop policy if exists "teachers update attendance for their class" on public.attendance_records;
create policy "teachers update attendance for their class"
  on public.attendance_records for update
  using (public.current_role() = 'teacher' and class_name = public.current_assigned_class())
  with check (
    public.current_role() = 'teacher'
    and class_name = public.current_assigned_class()
    and marked_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student' and p.grade = class_name)
  );

-- ------------------------------------------------------------
-- Calendar document storage -- a public bucket (same pattern as
-- avatars): the file itself isn't sensitive and every role needs to
-- view/download it directly. Only admins can write to it.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('school-documents', 'school-documents', true)
on conflict (id) do nothing;

drop policy if exists "school documents are publicly readable" on storage.objects;
create policy "school documents are publicly readable"
  on storage.objects for select
  using (bucket_id = 'school-documents');

drop policy if exists "admins upload school documents" on storage.objects;
create policy "admins upload school documents"
  on storage.objects for insert
  with check (bucket_id = 'school-documents' and public.current_role() = 'admin');

drop policy if exists "admins replace school documents" on storage.objects;
create policy "admins replace school documents"
  on storage.objects for update
  using (bucket_id = 'school-documents' and public.current_role() = 'admin');

drop policy if exists "admins remove school documents" on storage.objects;
create policy "admins remove school documents"
  on storage.objects for delete
  using (bucket_id = 'school-documents' and public.current_role() = 'admin');

alter publication supabase_realtime add table public.attendance_records;
