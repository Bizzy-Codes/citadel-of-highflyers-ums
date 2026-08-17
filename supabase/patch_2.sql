-- ============================================================
-- Patch 2: run this once in the SQL Editor, after patch_1.sql.
-- Safe to run even if partially applied -- everything here is
-- idempotent.
--
-- What it does:
--   1. Adds ca1/ca2/exam breakdown columns to results (score stays
--      the stored total = ca1+ca2+exam, computed app-side, so
--      every existing read path keeps working unchanged).
--   2. Adds a report_cards table: one row per student per term,
--      holding term dates, remarks, comments/signatures, and the
--      fixed psychomotor/affective domain ratings from the school's
--      official report sheet.
--   3. Adds a subject_class_stats() function that computes a
--      subject's class lowest/average/highest/class_position live, as a
--      SECURITY DEFINER call -- so a student can see their class
--      ranking without an RLS policy exposing classmates' raw
--      results rows to them.
-- ============================================================

alter table public.results add column if not exists ca1 numeric(5,2);
alter table public.results add column if not exists ca2 numeric(5,2);
alter table public.results add column if not exists exam numeric(5,2);

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  term text not null check (term in ('1st Term', '2nd Term', '3rd Term')),
  session text not null,
  term_ends date,
  next_term_begins date,
  remark text,
  headmaster_comment text,
  class_teacher_comment text,
  headmaster_signature text,
  class_teacher_signature text,
  -- Psychomotor domain (skills & sports). Rating one of:
  -- 'Excellent' | 'Very Good' | 'Good' | 'Average' | 'Poor'
  comm_oral_rating text,
  creativity_rating text,
  drawing_painting_rating text,
  music_rating text,
  sports_rating text,
  -- Affective domain (conduct observations), same rating scale
  honesty_rating text,
  punctuality_rating text,
  attentiveness_rating text,
  politeness_rating text,
  obedience_rating text,
  independence_rating text,
  social_rating text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term, session)
);`

alter table public.report_cards enable row level security;
grant select, insert, update, delete on public.report_cards to authenticated;

drop policy if exists "students view own report card" on public.report_cards;
create policy "students view own report card"
  on public.report_cards for select
  using (student_id = auth.uid());

drop policy if exists "teachers view report cards for their class" on public.report_cards;
create policy "teachers view report cards for their class"
  on public.report_cards for select
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.profiles pr where pr.id = student_id and pr.grade = public.current_assigned_class()
    )
  );

drop policy if exists "teachers write report cards for their class" on public.report_cards;
create policy "teachers write report cards for their class"
  on public.report_cards for all
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.profiles pr where pr.id = student_id and pr.grade = public.current_assigned_class()
    )
  )
  with check (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.profiles pr where pr.id = student_id and pr.grade = public.current_assigned_class()
    )
  );

drop policy if exists "admins full access to report cards" on public.report_cards;
create policy "admins full access to report cards"
  on public.report_cards for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Live class stats for one subject, scoped to the target student's
-- own class. SECURITY DEFINER so it can read every classmate's
-- results row internally, but it only ever returns aggregate
-- numbers plus the target student's own rank -- never another
-- student's identity or raw score -- so it's safe to expose to any
-- authenticated caller (student viewing their own card, teacher or
-- admin printing any card in scope).
create or replace function public.subject_class_stats(
  p_student_id uuid, p_subject text, p_term_value text, p_session text
)
returns table(lowest numeric, average numeric, highest numeric, class_position bigint, total_in_class bigint)
language sql stable security definer set search_path = public as $$
  with target_class as (
    select grade from public.profiles where id = p_student_id
  ),
  class_scores as (
    select res.student_id, res.score
    from public.results res join public.profiles pr on pr.id = res.student_id
    where res.subject = p_subject
      and res.term = p_term_value
      and res.session = p_session
      and pr.role = 'student'
      and pr.grade = (select grade from target_class)
  ),
  ranked as (
    select student_id, rank() over (order by score desc) as student_rank from class_scores
  )
  select
    min(score)::numeric,
    round(avg(score)::numeric, 2),
    max(score)::numeric,
    (select student_rank from ranked where student_id = p_student_id),
    count(*)
  from class_scores;
$$;

grant execute on function public.subject_class_stats to authenticated;
