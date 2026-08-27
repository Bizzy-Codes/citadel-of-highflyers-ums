-- ============================================================
-- Citadel Highflyers UMS -- patch 18
-- Adds a 4th attendance status, 'holiday', so a day school is closed
-- can be marked as such instead of a teacher either leaving it blank
-- (which the pupil-facing attendance % would otherwise count against
-- them as a missed day) or marking everyone "absent" for a day nobody
-- was expected to attend.
-- ============================================================

alter table public.attendance_records drop constraint if exists attendance_records_status_check;
alter table public.attendance_records add constraint attendance_records_status_check
  check (status in ('present', 'absent', 'late', 'holiday'));
