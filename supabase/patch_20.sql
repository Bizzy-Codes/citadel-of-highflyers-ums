-- ============================================================
-- Citadel Highflyers UMS -- patch 20
-- Update attendance system for continuous week numbering and daily notes
--
-- Changes:
-- 1. Remove 'late' status from attendance_records (now only present/absent/holiday)
-- 2. Migrate attendance_notes from week-based to date-based storage
--    - Rename week_start column to note_date
--    - Update indexes and unique constraints
--    - Update RLS policies
-- ============================================================

-- Step 1: Update attendance_records status check constraint
alter table public.attendance_records drop constraint if exists attendance_records_status_check;
alter table public.attendance_records add constraint attendance_records_status_check
  check (status in ('present', 'absent', 'holiday'));

-- Step 2: Migrate attendance_notes from week-based to date-based
-- First, add the new note_date column if it doesn't exist
alter table public.attendance_notes add column if not exists note_date date;

-- Copy data from week_start to note_date (week_start is the Monday, which is the start date)
update public.attendance_notes set note_date = week_start where note_date is null;

-- Make note_date not null after migration
alter table public.attendance_notes alter column note_date set not null;

-- Drop old indexes
drop index if exists attendance_notes_class_week_idx;

-- Drop old unique constraint (can't just drop it, must recreate without week_start)
alter table public.attendance_notes drop constraint if exists attendance_notes_student_id_week_start_key;

-- Add new unique constraint on (student_id, note_date)
alter table public.attendance_notes add unique (student_id, note_date);

-- Create new index on class_name and note_date
create index if not exists attendance_notes_class_date_idx on public.attendance_notes (class_name, note_date);

-- Drop the week_start column (only after confirming data migration is complete)
alter table public.attendance_notes drop column if exists week_start;

-- Update RLS policies for the new schema
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

-- Ensure realtime publication includes the updated table
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance_notes'
  ) then
    alter publication supabase_realtime add table public.attendance_notes;
  end if;
end $$;
