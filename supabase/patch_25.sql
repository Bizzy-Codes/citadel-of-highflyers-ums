-- ============================================================
-- Citadel Highflyers UMS -- patch 25
--
-- The term calendar, readable in the portal.
--
-- Until now the calendar was only ever a file to download: a pupil on
-- a phone got a PDF or an image and had to pinch around it. The admin
-- screen can now read a Word (.docx) or PDF upload and turn it into a
-- grid, which is stored here and rendered as a proper table for
-- pupils and staff.
--
-- Shape is an array of tables, each with the heading that sat above it
-- in the document:
--   [ { "heading": "FIRST TERM", "rows": [["WEEK","DATE"],["1","8 Sept"]] } ]
--
-- The first row of each table is treated as its header. Stored on the
-- existing single-row settings table rather than a new one -- it is
-- one more attribute of the calendar, read by exactly the people who
-- already read the calendar, so patch_14's policies cover it as is.
-- ============================================================

alter table public.academic_calendar
  add column if not exists document_tables jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
