-- ============================================================
-- Citadel Highflyers UMS -- patch 44
--
-- Assignments can have multiple-choice questions (options A, B, C, D ...
-- with a correct answer), like tests. The correct answer lives in its own
-- table that only the class teacher and admins can read, so a pupil can
-- never fetch the answer key.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter table public.assignment_questions add column if not exists qtype text not null default 'written';
alter table public.assignment_questions drop constraint if exists assignment_questions_qtype_check;
alter table public.assignment_questions add constraint assignment_questions_qtype_check
  check (qtype in ('written', 'objective'));
alter table public.assignment_questions add column if not exists options jsonb;  -- [{ "key": "A", "text": "..." }, ...]

create table if not exists public.assignment_question_keys (
  question_id uuid primary key references public.assignment_questions(id) on delete cascade,
  correct_option text not null
);
alter table public.assignment_question_keys enable row level security;
grant select, insert, update, delete on public.assignment_question_keys to authenticated;

-- No pupil policy at all: with RLS on, that means pupils get zero rows.
drop policy if exists "teachers manage keys of their class assignments" on public.assignment_question_keys;
create policy "teachers manage keys of their class assignments"
  on public.assignment_question_keys for all
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.assignment_questions q
      join public.assignments a on a.id = q.assignment_id
      where q.id = question_id and a.class_name = public.current_assigned_class()
    )
  )
  with check (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.assignment_questions q
      join public.assignments a on a.id = q.assignment_id
      where q.id = question_id and a.class_name = public.current_assigned_class()
    )
  );

drop policy if exists "admins full access to assignment_question_keys" on public.assignment_question_keys;
create policy "admins full access to assignment_question_keys"
  on public.assignment_question_keys for all
  using (coalesce(public.current_role(), '') = 'admin')
  with check (coalesce(public.current_role(), '') = 'admin');

notify pgrst, 'reload schema';
