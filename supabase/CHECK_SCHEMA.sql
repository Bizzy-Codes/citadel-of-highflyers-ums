-- ============================================================
-- Citadel Highflyers UMS -- schema health check (READ ONLY)
--
-- Run this in the Supabase SQL Editor. It changes nothing -- it just
-- reports which pieces of the schema are present, so a feature that
-- "doesn't work" can be traced to a patch that was never run rather
-- than guessed at from the app side.
--
-- Anything reported as MISSING means: run the patch named next to it.
-- ============================================================

with expected(feature, kind, obj, patch) as (values
  -- profiles columns added after schema.sql
  ('Profile email',            'column',   'profiles.email',            'patch_1.sql'),
  ('Profile avatar',           'column',   'profiles.avatar_url',       'patch_4.sql'),
  ('Profile location',         'column',   'profiles.location',         'patch_11.sql'),
  -- feature tables
  ('Private messaging',        'table',    'direct_messages',           'patch_6.sql'),
  ('Online tests',             'table',    'tests',                     'patch_7.sql'),
  ('Test questions',           'table',    'test_questions',            'patch_7.sql'),
  ('Test attempts',            'table',    'test_attempts',             'patch_7.sql'),
  ('Test answers',             'table',    'test_answers',              'patch_7.sql'),
  ('Assignments',              'table',    'assignments',               'patch_5.sql'),
  ('Payment receipts',         'table',    'payment_receipts',          'patch_9.sql'),
  ('Admission applications',   'table',    'admission_applications',    'patch_10.sql'),
  ('Report cards',             'table',    'report_cards',              'patch_12.sql'),
  ('Academic calendar',        'table',    'academic_calendar',         'patch_14.sql'),
  ('Attendance register',      'table',    'attendance_records',        'patch_14.sql'),
  ('Attendance notes',         'table',    'attendance_notes',          'patch_17.sql'),
  -- functions the app calls directly
  ('Take a test (questions)',  'function', 'get_attempt_questions',     'patch_7.sql'),
  ('Take a test (save answer)','function', 'save_test_answer',          'patch_7.sql'),
  ('Take a test (submit)',     'function', 'submit_test_attempt',       'patch_7.sql'),
  ('Names stored in CAPITALS', 'function', 'uppercase_person_names',    'patch_27.sql'),
  ('Take a test (strikes)',    'function', 'record_test_violation',     'patch_28.sql'),
  ('Graduated archive',        'column',   'profiles.graduated_at',     'patch_29.sql'),
  ('Promote / graduate pupil', 'function', 'promote_student',           'patch_30.sql')
)
select
  e.feature,
  e.obj,
  case
    when e.kind = 'column' then
      case when exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = split_part(e.obj, '.', 1)
          and c.column_name = split_part(e.obj, '.', 2)
      ) then 'OK' else 'MISSING -- run ' || e.patch end
    when e.kind = 'table' then
      case when exists (
        select 1 from information_schema.tables t
        where t.table_schema = 'public' and t.table_name = e.obj
      ) then 'OK' else 'MISSING -- run ' || e.patch end
    else
      case when exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = e.obj
      ) then 'OK' else 'MISSING -- run ' || e.patch end
  end as status
from expected e
order by status desc, e.feature;

-- Attendance statuses allowed (should include 'holiday' after patch_18)
select 'attendance status values' as check,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'attendance_records_status_check';
