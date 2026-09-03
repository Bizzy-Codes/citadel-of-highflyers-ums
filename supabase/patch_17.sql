-- ============================================================
-- Citadel Highflyers UMS -- patch 17
-- A per-pupil, per-week note on the attendance register -- lets a
-- teacher flag a reason for an absence, an incident, or anything else
-- worth the admin seeing, without cluttering the day-by-day grid
-- itself. One note per (pupil, week), keyed by that week's Monday.
-- ============================================================

create table if not exists public.attendance_notes (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  note text not null check (char_length(note) between 1 and 2000),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (student_id, week_start)
);

create index if not exists attendance_notes_class_week_idx on public.attendance_notes (class_name, week_start);

alter table public.attendance_notes  enable row level security;
grant select, insert, update, delete on public.attendance_notes to authenticated;

drop policy if exists "students view own attendance notes" on public.attendance_notes;
create policy "students view own attendance notes"
  on public.attendance_notes for select
  using (student_id = auth.uid());

drop policy if exists "teachers manage attendance notes for their class" on public.attendance_notes;
create policy "teachers manage attendance notes for their class"
  on public.attendance_notes for all
  using (public.current_role() = 'teacher' and class_name = public.current_assigned_class())
  with check (
    public.current_role() = 'teacher'
    and class_name = public.current_assigned_class()
    and updated_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student' and p.grade = class_name)
  );

drop policy if exists "admins view all attendance notes" on public.attendance_notes;
create policy "admins view all attendance notes"
  on public.attendance_notes for select
  using (public.current_role() = 'admin');

-- Plain ALTER PUBLICATION ... ADD TABLE has no "if not exists" form and
-- errors (42710) if this patch is ever re-run after already succeeding
-- once -- guard it so re-running the file is always safe.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance_notes'
  ) then
    alter publication supabase_realtime add table public.attendance_notes;
  end if;
end $$;
