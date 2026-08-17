-- ============================================================
-- Citadel Highflyers UMS -- patch 7
-- Online Exams/Tests: teacher-authored timed tests (objective +
-- essay questions), one-attempt student-taking with server-trusted
-- timing, mechanical objective auto-grading, tab-switch anti-cheat
-- with server-side strike counting, and a live teacher monitor.
--
-- Answer-key safety: test_questions has NO select policy for
-- students at all. The only way a student ever sees question text
-- is through get_attempt_questions(), a SECURITY DEFINER function
-- with a hand-picked column list that omits correct_option,
-- model_answer, and keywords. Every attempt-mutating action (start,
-- save answer, submit, record violation) goes through a SECURITY
-- DEFINER RPC that re-checks ownership/status/expiry server-side --
-- there is no client-writable path to test_attempts or test_answers
-- for students, so timers, one-attempt enforcement, and strike
-- counts cannot be forged from the browser console.
-- ============================================================

-- current_grade() is normally defined by patch_5.sql (Assignments).
-- Redefined here too (identical body, `create or replace` so this is
-- a harmless no-op if patch_5 already ran) so patch_7 doesn't require
-- patch_5 to have been applied first -- current_role() and
-- current_assigned_class(), used below, come from policies.sql and
-- are assumed to already exist (schema.sql + policies.sql are the
-- base setup every later patch builds on).
create or replace function public.current_grade()
returns text
language sql stable security definer set search_path = public
as $$
  select grade from public.profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  subject text not null,
  title text not null,
  instructions text,
  duration_minutes int not null check (duration_minutes > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  total_points numeric(8,2) not null default 0,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  order_index int not null default 0,
  type text not null check (type in ('objective', 'essay')),
  prompt text not null,
  points numeric(6,2) not null default 1 check (points > 0),
  options jsonb,             -- objective: [{ "key": "A", "text": "..." }, ...]
  correct_option text,       -- objective only -- SENSITIVE, see RLS note below
  model_answer text,         -- essay only -- teacher's reference answer, SENSITIVE
  keywords jsonb,            -- essay only: [{ "phrase": "...", "points": 2 }, ...] for future AI grading, SENSITIVE
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'terminated', 'expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,     -- set server-side at insert = now() + duration, never client-supplied
  submitted_at timestamptz,
  score numeric(8,2),                  -- kept in sync by recalc_attempt_score() trigger below
  max_score numeric(8,2) not null default 0,  -- snapshot of tests.total_points at start time
  violation_count int not null default 0,
  terminated_reason text,
  unique (test_id, student_id)         -- enforces ONE attempt per student per test
);

create table if not exists public.test_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.test_questions(id) on delete cascade,
  selected_option text,
  essay_text text,
  is_correct boolean,          -- objective only, computed server-side at submit/expire/terminate
  points_awarded numeric(6,2), -- objective: auto; essay: filled by teacher now, by AI grader later
  ai_feedback text,            -- reserved for a future AI grading pass -- service role bypasses RLS, no policy needed
  feedback text,               -- teacher's manual essay grading comment
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.exam_violations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  -- test_id/student_id are denormalized off the attempt so the
  -- teacher's live monitor can filter Realtime events by test_id
  -- directly, without a join.
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'tab_switch' check (kind in ('tab_switch')),
  occurred_at timestamptz not null default now()
);

create index if not exists test_questions_test_id_idx on public.test_questions (test_id, order_index);
create index if not exists test_attempts_test_id_idx on public.test_attempts (test_id);
create index if not exists test_answers_attempt_id_idx on public.test_answers (attempt_id);
create index if not exists exam_violations_test_id_idx on public.exam_violations (test_id, occurred_at desc);

alter table public.tests enable row level security;
alter table public.test_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.test_answers enable row level security;
alter table public.exam_violations enable row level security;

grant select, insert, update, delete on
  public.tests, public.test_questions, public.test_attempts, public.test_answers, public.exam_violations
  to authenticated;

-- ------------------------------------------------------------
-- tests
-- ------------------------------------------------------------
drop policy if exists "students view non-draft tests for their class" on public.tests;
create policy "students view non-draft tests for their class"
  on public.tests for select
  using (public.current_role() = 'student' and class_name = public.current_grade() and status <> 'draft');

drop policy if exists "teachers manage tests for their class" on public.tests;
create policy "teachers manage tests for their class"
  on public.tests for all
  using (public.current_role() = 'teacher' and class_name = public.current_assigned_class())
  with check (public.current_role() = 'teacher' and class_name = public.current_assigned_class());

drop policy if exists "admins full access to tests" on public.tests;
create policy "admins full access to tests"
  on public.tests for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- test_questions -- NO student policy of any kind. RLS defaults to
-- deny-all once enabled with no matching policy, so a student
-- calling supabase.from('test_questions').select() directly gets
-- zero rows, including correct_option/model_answer/keywords, no
-- matter what the app "chooses" to render.
-- ------------------------------------------------------------
drop policy if exists "teachers manage questions for their class tests" on public.test_questions;
create policy "teachers manage questions for their class tests"
  on public.test_questions for all
  using (
    public.current_role() = 'teacher'
    and exists (select 1 from public.tests t where t.id = test_id and t.class_name = public.current_assigned_class())
  )
  with check (
    public.current_role() = 'teacher'
    and exists (select 1 from public.tests t where t.id = test_id and t.class_name = public.current_assigned_class())
  );

drop policy if exists "admins full access to test_questions" on public.test_questions;
create policy "admins full access to test_questions"
  on public.test_questions for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- test_attempts -- no insert/update policy for students or
-- teachers: every write happens through a SECURITY DEFINER RPC
-- below.
-- ------------------------------------------------------------
drop policy if exists "students view own attempts" on public.test_attempts;
create policy "students view own attempts"
  on public.test_attempts for select
  using (student_id = auth.uid());

drop policy if exists "teachers view attempts for their class tests" on public.test_attempts;
create policy "teachers view attempts for their class tests"
  on public.test_attempts for select
  using (
    public.current_role() = 'teacher'
    and exists (select 1 from public.tests t where t.id = test_id and t.class_name = public.current_assigned_class())
  );

drop policy if exists "admins full access to test_attempts" on public.test_attempts;
create policy "admins full access to test_attempts"
  on public.test_attempts for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- test_answers
-- ------------------------------------------------------------
drop policy if exists "students view own answers" on public.test_answers;
create policy "students view own answers"
  on public.test_answers for select
  using (exists (select 1 from public.test_attempts a where a.id = attempt_id and a.student_id = auth.uid()));

drop policy if exists "teachers view answers for their class tests" on public.test_answers;
create policy "teachers view answers for their class tests"
  on public.test_answers for select
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.test_attempts a join public.tests t on t.id = a.test_id
      where a.id = attempt_id and t.class_name = public.current_assigned_class()
    )
  );

-- Teachers grade essay answers directly via plain UPDATE (same
-- pattern as assignment_submissions grading) -- but only once the
-- attempt has finished, and only on essay-type questions, so a
-- teacher can't edit points_awarded on a still-in-progress attempt
-- or quietly rewrite an objective grade.
drop policy if exists "teachers grade essay answers for finished attempts" on public.test_answers;
create policy "teachers grade essay answers for finished attempts"
  on public.test_answers for update
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.test_attempts a
      join public.tests t on t.id = a.test_id
      join public.test_questions q on q.id = question_id
      where a.id = attempt_id
        and t.class_name = public.current_assigned_class()
        and a.status in ('submitted', 'terminated', 'expired')
        and q.type = 'essay'
    )
  );

drop policy if exists "admins full access to test_answers" on public.test_answers;
create policy "admins full access to test_answers"
  on public.test_answers for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- exam_violations -- no student policy at all (their own
-- violation_count is already visible on their test_attempts row);
-- no insert policy for anyone -- rows are only ever inserted by
-- record_test_violation().
-- ------------------------------------------------------------
drop policy if exists "teachers view violations for their class tests" on public.exam_violations;
create policy "teachers view violations for their class tests"
  on public.exam_violations for select
  using (
    public.current_role() = 'teacher'
    and exists (select 1 from public.tests t where t.id = test_id and t.class_name = public.current_assigned_class())
  );

drop policy if exists "admins full access to exam_violations" on public.exam_violations;
create policy "admins full access to exam_violations"
  on public.exam_violations for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- Trigger: keep tests.total_points in sync with its questions.
-- ------------------------------------------------------------
create or replace function public.recalc_test_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_test_id uuid := coalesce(new.test_id, old.test_id);
begin
  update public.tests
  set total_points = (select coalesce(sum(points), 0) from public.test_questions where test_id = v_test_id),
      updated_at = now()
  where id = v_test_id;
  return null;
end;
$$;

drop trigger if exists test_questions_recalc_points on public.test_questions;
create trigger test_questions_recalc_points
  after insert or update of points or delete on public.test_questions
  for each row execute function public.recalc_test_points();

-- ------------------------------------------------------------
-- Trigger: keep test_attempts.score in sync with test_answers --
-- fires for BOTH the objective auto-grade pass and a teacher's
-- later manual essay grade, so there is exactly one place score
-- rollup logic lives.
-- ------------------------------------------------------------
create or replace function public.recalc_attempt_score()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_attempt_id uuid := coalesce(new.attempt_id, old.attempt_id);
begin
  update public.test_attempts
  set score = (select coalesce(sum(points_awarded), 0) from public.test_answers where attempt_id = v_attempt_id)
  where id = v_attempt_id;
  return null;
end;
$$;

drop trigger if exists test_answers_recalc_attempt_score on public.test_answers;
create trigger test_answers_recalc_attempt_score
  after insert or update of points_awarded or delete on public.test_answers
  for each row execute function public.recalc_attempt_score();

-- ------------------------------------------------------------
-- Internal helper (NOT granted to authenticated -- only callable
-- from the SECURITY DEFINER RPCs below, which already verified
-- ownership/authorization before calling it).
-- ------------------------------------------------------------
create or replace function public.grade_and_close_attempt(p_attempt_id uuid, p_status text, p_reason text default null)
returns table(score numeric, max_score numeric, status text)
language plpgsql security definer set search_path = public as $$
begin
  update public.test_answers ta
  set is_correct = (ta.selected_option = tq.correct_option),
      points_awarded = case when ta.selected_option = tq.correct_option then tq.points else 0 end
  from public.test_questions tq
  where ta.question_id = tq.id and ta.attempt_id = p_attempt_id and tq.type = 'objective';

  update public.test_attempts
  set status = p_status, submitted_at = now(), terminated_reason = p_reason
  where id = p_attempt_id;

  return query select ta.score, ta.max_score, ta.status from public.test_attempts ta where ta.id = p_attempt_id;
end;
$$;

-- ------------------------------------------------------------
-- start_test_attempt: the only way a test_attempts row is created.
-- ------------------------------------------------------------
create or replace function public.start_test_attempt(p_test_id uuid)
returns table(attempt_id uuid, expires_at timestamptz, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_class text; v_duration int; v_test_status text; v_max numeric;
  v_existing_id uuid; v_existing_status text; v_existing_expires timestamptz;
  v_new_id uuid; v_new_expires timestamptz;
begin
  perform public.finalize_expired_attempts();

  select t.class_name, t.duration_minutes, t.status, t.total_points
    into v_class, v_duration, v_test_status, v_max
  from public.tests t where t.id = p_test_id;

  if v_class is null then raise exception 'Test not found'; end if;
  if v_test_status <> 'published' then raise exception 'Test is not open for attempts'; end if;
  if v_class <> public.current_grade() then raise exception 'Not your class test'; end if;

  select a.id, a.status, a.expires_at into v_existing_id, v_existing_status, v_existing_expires
  from public.test_attempts a where a.test_id = p_test_id and a.student_id = auth.uid();

  if v_existing_id is not null then
    if v_existing_status = 'in_progress' then
      return query select v_existing_id, v_existing_expires, v_existing_status;
      return;
    end if;
    raise exception 'You have already attempted this test';
  end if;

  insert into public.test_attempts (test_id, student_id, expires_at, max_score)
  values (p_test_id, auth.uid(), now() + make_interval(mins => v_duration), v_max)
  returning id, test_attempts.expires_at into v_new_id, v_new_expires;

  return query select v_new_id, v_new_expires, 'in_progress'::text;
end;
$$;
grant execute on function public.start_test_attempt(uuid) to authenticated;

-- ------------------------------------------------------------
-- get_attempt_questions: the ONLY path a student ever sees question
-- text through. Column list is hand-picked -- correct_option,
-- model_answer, keywords never appear. Also returns the student's
-- own previously-saved answers so a page refresh mid-attempt resumes
-- cleanly.
-- ------------------------------------------------------------
create or replace function public.get_attempt_questions(p_attempt_id uuid)
returns table(
  question_id uuid, order_index int, type text, prompt text, points numeric,
  options jsonb, selected_option text, essay_text text
)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_status text;
begin
  perform public.finalize_expired_attempts();

  select student_id, status into v_owner, v_status from public.test_attempts where id = p_attempt_id;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Not your attempt'; end if;
  if v_status <> 'in_progress' then raise exception 'This attempt is no longer active (status: %)', v_status; end if;

  return query
    select q.id, q.order_index, q.type, q.prompt, q.points, q.options, a.selected_option, a.essay_text
    from public.test_questions q
    left join public.test_answers a on a.question_id = q.id and a.attempt_id = p_attempt_id
    where q.test_id = (select test_id from public.test_attempts where id = p_attempt_id)
    order by q.order_index;
end;
$$;
grant execute on function public.get_attempt_questions(uuid) to authenticated;

-- ------------------------------------------------------------
-- save_test_answer: autosave. Re-checks ownership/status/expiry on
-- every call so a stale client can't write past time-up.
-- ------------------------------------------------------------
create or replace function public.save_test_answer(
  p_attempt_id uuid, p_question_id uuid, p_selected_option text default null, p_essay_text text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_status text; v_expires timestamptz; v_test_id uuid;
begin
  select student_id, status, expires_at, test_id into v_owner, v_status, v_expires, v_test_id
  from public.test_attempts where id = p_attempt_id;

  if v_owner is null or v_owner <> auth.uid() then raise exception 'Not your attempt'; end if;
  if v_status <> 'in_progress' then raise exception 'Attempt is not in progress'; end if;
  if v_expires < now() then
    perform public.grade_and_close_attempt(p_attempt_id, 'expired', null);
    raise exception 'Time is up -- attempt auto-submitted';
  end if;
  if not exists (select 1 from public.test_questions where id = p_question_id and test_id = v_test_id) then
    raise exception 'Question does not belong to this attempt';
  end if;

  insert into public.test_answers (attempt_id, question_id, selected_option, essay_text, updated_at)
  values (p_attempt_id, p_question_id, p_selected_option, p_essay_text, now())
  on conflict (attempt_id, question_id)
  do update set selected_option = excluded.selected_option, essay_text = excluded.essay_text, updated_at = now();
end;
$$;
grant execute on function public.save_test_answer(uuid, uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- submit_test_attempt: student-initiated submit. Server re-verifies
-- status regardless of what the client's clock thinks.
-- ------------------------------------------------------------
create or replace function public.submit_test_attempt(p_attempt_id uuid)
returns table(score numeric, max_score numeric, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_status text;
begin
  select student_id, status into v_owner, v_status from public.test_attempts where id = p_attempt_id;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Not your attempt'; end if;
  if v_status <> 'in_progress' then raise exception 'Attempt is not in progress'; end if;
  return query select * from public.grade_and_close_attempt(p_attempt_id, 'submitted', null);
end;
$$;
grant execute on function public.submit_test_attempt(uuid) to authenticated;

-- ------------------------------------------------------------
-- record_test_violation: server-trusted strike counter. The
-- UPDATE's row lock makes the increment atomic even if two calls
-- land near-simultaneously (e.g. blur + visibilitychange both
-- slipping past client-side dedupe) -- no strike is ever lost or
-- double-counted at the DB layer.
-- ------------------------------------------------------------
create or replace function public.record_test_violation(p_attempt_id uuid)
returns table(violation_count int, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_status text; v_expires timestamptz; v_count int;
begin
  select student_id, status, expires_at into v_owner, v_status, v_expires
  from public.test_attempts where id = p_attempt_id;

  if v_owner is null or v_owner <> auth.uid() then raise exception 'Not your attempt'; end if;

  if v_status <> 'in_progress' then
    return query select ta.violation_count, ta.status from public.test_attempts ta where ta.id = p_attempt_id;
    return;
  end if;

  if v_expires < now() then
    perform public.grade_and_close_attempt(p_attempt_id, 'expired', null);
    return query select ta.violation_count, ta.status from public.test_attempts ta where ta.id = p_attempt_id;
    return;
  end if;

  insert into public.exam_violations (attempt_id, test_id, student_id, kind)
  select p_attempt_id, test_id, student_id, 'tab_switch' from public.test_attempts where id = p_attempt_id;

  update public.test_attempts set violation_count = violation_count + 1
  where id = p_attempt_id
  returning violation_count into v_count;

  if v_count >= 3 then
    perform public.grade_and_close_attempt(p_attempt_id, 'terminated', 'tab_switch_limit');
  end if;

  return query select ta.violation_count, ta.status from public.test_attempts ta where ta.id = p_attempt_id;
end;
$$;
grant execute on function public.record_test_violation(uuid) to authenticated;

-- ------------------------------------------------------------
-- finalize_expired_attempts: self-service safety net, scoped to the
-- calling student's OWN rows.
-- ------------------------------------------------------------
create or replace function public.finalize_expired_attempts()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id from public.test_attempts
    where student_id = auth.uid() and status = 'in_progress' and expires_at < now()
  loop
    perform public.grade_and_close_attempt(r.id, 'expired', null);
  end loop;
end;
$$;
grant execute on function public.finalize_expired_attempts() to authenticated;

-- ------------------------------------------------------------
-- finalize_expired_attempts_for_test: covers a student closing the
-- tab and never returning -- a teacher/admin can sweep their own
-- test's expired attempts from the Live Monitor.
-- ------------------------------------------------------------
create or replace function public.finalize_expired_attempts_for_test(p_test_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_class text;
begin
  select class_name into v_class from public.tests where id = p_test_id;
  if v_class is null then raise exception 'Test not found'; end if;
  if public.current_role() = 'teacher' and v_class <> public.current_assigned_class() then
    raise exception 'Not your class test';
  elsif public.current_role() not in ('teacher', 'admin') then
    raise exception 'Not authorized';
  end if;

  for r in
    select id from public.test_attempts
    where test_id = p_test_id and status = 'in_progress' and expires_at < now()
  loop
    perform public.grade_and_close_attempt(r.id, 'expired', null);
  end loop;
end;
$$;
grant execute on function public.finalize_expired_attempts_for_test(uuid) to authenticated;

-- ------------------------------------------------------------
-- Realtime for the teacher's Live Monitor.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.exam_violations;
alter publication supabase_realtime add table public.test_attempts;
