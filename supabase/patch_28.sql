-- ============================================================
-- Citadel Highflyers UMS -- patch 28
--
-- Fix: submitting a test failed for every pupil with
--   column reference "status" is ambiguous
-- and the same error silently broke the tab-switch strike counter.
--
-- Both submit_test_attempt() and record_test_violation() RETURN a
-- column called `status`, and PL/pgSQL treats that output column as a
-- variable inside the body. Their first SELECT read the unqualified
-- `status` column of test_attempts, so Postgres could not tell the
-- variable from the column and raised instead of guessing. Qualifying
-- the column with a table alias removes the ambiguity. Nothing else
-- about either function changes.
-- ============================================================

create or replace function public.submit_test_attempt(p_attempt_id uuid)
returns table(score numeric, max_score numeric, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_status text;
begin
  select a.student_id, a.status into v_owner, v_status
  from public.test_attempts a where a.id = p_attempt_id;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Not your attempt'; end if;
  if v_status <> 'in_progress' then raise exception 'Attempt is not in progress'; end if;
  return query select * from public.grade_and_close_attempt(p_attempt_id, 'submitted', null);
end;
$$;
grant execute on function public.submit_test_attempt(uuid) to authenticated;

create or replace function public.record_test_violation(p_attempt_id uuid)
returns table(violation_count int, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_status text; v_expires timestamptz; v_count int;
begin
  select a.student_id, a.status, a.expires_at into v_owner, v_status, v_expires
  from public.test_attempts a where a.id = p_attempt_id;

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
  select a.id, a.test_id, a.student_id, 'tab_switch' from public.test_attempts a where a.id = p_attempt_id;

  update public.test_attempts a set violation_count = a.violation_count + 1
  where a.id = p_attempt_id
  returning a.violation_count into v_count;

  if v_count >= 3 then
    perform public.grade_and_close_attempt(p_attempt_id, 'terminated', 'tab_switch_limit');
  end if;

  return query select ta.violation_count, ta.status from public.test_attempts ta where ta.id = p_attempt_id;
end;
$$;
grant execute on function public.record_test_violation(uuid) to authenticated;
