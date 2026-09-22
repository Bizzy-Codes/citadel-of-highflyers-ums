-- ============================================================
-- Citadel Highflyers UMS -- patch 29
--
-- Graduation. Grade 5 is the last class, so "promote" from there has
-- nowhere to send a pupil. They now move into a Graduated archive
-- instead of being stuck in Grade 5 forever or quietly deleted.
--
-- A graduate keeps their account and can still sign in to look at
-- their own results. What changes is that they leave the class lists
-- and the "Total Pupils" count, because they are no longer a pupil
-- the school is teaching this term.
--
-- Representation:
--   grade        = 'Graduated'  -- not one of CLASSES, so every screen
--                                 that lists a class drops them already
--   graduated_at = when it happened, for the archive's ordering and
--                  for showing "Graduated 23 Sep 2026"
--   final_class  = the class they left from, so the archive can say
--                  "Grade 5, 2025/2026" without digging through
--                  academic_history
-- ============================================================

alter table public.profiles
  add column if not exists graduated_at timestamptz,
  add column if not exists final_class text,
  add column if not exists graduating_session text;

-- Index the archive lookup: "every graduate, newest first".
create index if not exists profiles_graduated_at_idx
  on public.profiles (graduated_at desc)
  where graduated_at is not null;

comment on column public.profiles.graduated_at is
  'Set when a pupil is promoted out of the final class. Non-null means they are in the Graduated archive: still able to sign in, but excluded from class lists and pupil counts.';

notify pgrst, 'reload schema';
