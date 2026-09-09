-- ============================================================
-- Citadel Highflyers UMS -- patch 21
--
-- 1. academic_calendar.current_term / current_session
--    Structured "which term/session are we in" so teachers' result
--    sheets and report cards read it automatically and never ask per
--    pupil. Backfilled from the existing free-text `term`.
--
-- 2. results uniqueness
--    De-duplicates any (student, subject, term, session) rows the old
--    insert-only result entry could have produced, then adds a unique
--    index so the new grid save (delete-the-subjects-then-insert) has
--    a clean key.
--
-- 3. Essay auto-scoring in grade_and_close_attempt()
--    On submit/expire/terminate, every essay answer that a teacher
--    hasn't already graded gets a machine-suggested score from the
--    question's rubric keywords (sum of the points of each keyword
--    phrase that appears in the pupil's text, capped at the question's
--    points). ai_feedback marks it as a suggestion; a teacher can
--    still override it from the Live Monitor.
--
-- 4. get_attempt_progress()
--    Feeds the teacher's Live Monitor: per-attempt answered-count,
--    total questions, and last-answer time. Teacher/admin only.
-- ============================================================

-- ------------------------------------------------------------
-- 1. academic_calendar current term / session
-- ------------------------------------------------------------
alter table public.academic_calendar add column if not exists current_term text;
alter table public.academic_calendar add column if not exists current_session text;

alter table public.academic_calendar drop constraint if exists academic_calendar_current_term_check;
alter table public.academic_calendar add constraint academic_calendar_current_term_check
  check (current_term is null or current_term in ('1st Term', '2nd Term', '3rd Term'));

update public.academic_calendar
set current_term = coalesce(current_term, case
      when term ilike '%2nd%' or term ilike '%second%' then '2nd Term'
      when term ilike '%3rd%' or term ilike '%third%' then '3rd Term'
      else '1st Term'
    end),
    current_session = coalesce(current_session, substring(term from '\d{4}\s*/\s*\d{4}'))
where id = 1;

-- ------------------------------------------------------------
-- 2. results: de-dup + uniqueness guard
-- ------------------------------------------------------------
-- Drop older duplicates first...
delete from public.results r
using public.results dup
where r.student_id = dup.student_id
  and r.subject   = dup.subject
  and r.term      = dup.term
  and r.session   = dup.session
  and r.created_at < dup.created_at;

-- ...then break any exact-timestamp ties by id.
delete from public.results r
using public.results dup
where r.student_id = dup.student_id
  and r.subject   = dup.subject
  and r.term      = dup.term
  and r.session   = dup.session
  and r.created_at = dup.created_at
  and r.id < dup.id;

create unique index if not exists results_student_subject_term_session_key
  on public.results (student_id, subject, term, session);

-- ------------------------------------------------------------
-- 3. grade_and_close_attempt: objective auto-grade (unchanged) +
--    essay rubric auto-scoring (new).
-- ------------------------------------------------------------
create or replace function public.grade_and_close_attempt(p_attempt_id uuid, p_status text, p_reason text default null)
returns table(score numeric, max_score numeric, status text)
language plpgsql security definer set search_path = public as $$
begin
  -- Objective: mechanical mark against the answer key.
  update public.test_answers ta
  set is_correct = (ta.selected_option = tq.correct_option),
      points_awarded = case when ta.selected_option = tq.correct_option then tq.points else 0 end
  from public.test_questions tq
  where ta.question_id = tq.id and ta.attempt_id = p_attempt_id and tq.type = 'objective';

  -- Essay: rubric-keyword auto-score for answers not yet graded by a
  -- human. Sum the points of every keyword phrase found (case-
  -- insensitive) in the pupil's text, capped at the question's points.
  update public.test_answers ta
  set points_awarded = sub.awarded,
      ai_feedback = 'Auto-scored from ' || sub.hits || ' rubric keyword match(es)'
  from (
    select a.id as answer_id,
           least(
             q.points,
             coalesce(sum((kw.value->>'points')::numeric)
                      filter (where coalesce(kw.value->>'phrase', '') <> '' and a.essay_text ilike '%' || (kw.value->>'phrase') || '%'), 0)
           ) as awarded,
           count(*) filter (where coalesce(kw.value->>'phrase', '') <> '' and a.essay_text ilike '%' || (kw.value->>'phrase') || '%') as hits
    from public.test_answers a
    join public.test_questions q on q.id = a.question_id
    left join lateral jsonb_array_elements(
      case when jsonb_typeof(q.keywords) = 'array' then q.keywords else '[]'::jsonb end
    ) kw(value) on true
    where a.attempt_id = p_attempt_id
      and q.type = 'essay'
      and (case when jsonb_typeof(q.keywords) = 'array' then jsonb_array_length(q.keywords) else 0 end) > 0
      and a.graded_by is null
      and coalesce(a.essay_text, '') <> ''
    group by a.id, q.points
  ) sub
  where ta.id = sub.answer_id;

  update public.test_attempts
  set status = p_status, submitted_at = now(), terminated_reason = p_reason
  where id = p_attempt_id;

  return query select ta.score, ta.max_score, ta.status from public.test_attempts ta where ta.id = p_attempt_id;
end;
$$;

-- ------------------------------------------------------------
-- 4. get_attempt_progress: live "how far along is everyone" feed.
-- ------------------------------------------------------------
create or replace function public.get_attempt_progress(p_test_id uuid)
returns table(attempt_id uuid, answered_count int, total_questions int, last_activity_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_class text; v_total int;
begin
  select class_name into v_class from public.tests where id = p_test_id;
  if v_class is null then raise exception 'Test not found'; end if;
  if public.current_role() = 'teacher' and v_class <> public.current_assigned_class() then
    raise exception 'Not your class test';
  elsif public.current_role() not in ('teacher', 'admin') then
    raise exception 'Not authorized';
  end if;

  select count(*)::int into v_total from public.test_questions where test_id = p_test_id;

  return query
  select a.id,
         (select count(*)::int from public.test_answers ta
            where ta.attempt_id = a.id
              and (ta.selected_option is not null or coalesce(ta.essay_text, '') <> '')),
         v_total,
         (select max(ta.updated_at) from public.test_answers ta where ta.attempt_id = a.id)
  from public.test_attempts a
  where a.test_id = p_test_id;
end;
$$;
grant execute on function public.get_attempt_progress(uuid) to authenticated;

-- ------------------------------------------------------------
-- Tell PostgREST to pick up the new columns / functions.
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
