-- ============================================================
-- Citadel Highflyers UMS -- patch 30
--
-- Promotion is now a server-side operation.
--
-- The bug: a teacher pressing "Promote" never actually moved anyone.
-- The browser wrote straight to profiles.grade, but the RLS policy
-- "teachers update students in their class" only accepts rows that
-- stay inside the teacher's own class -- so moving a pupil OUT of it
-- was refused every time. The app ignored the error and still showed
-- "promoted", so the failure was invisible on both sides.
--
-- The fix: one SECURITY DEFINER function that does the whole thing in
-- a single transaction, and returns what it did.
--   * the next class is decided HERE, from the school's class order,
--     so a teacher can't send a pupil to an arbitrary class (the old
--     UI asked them to type one, defaulting to "Grade 2" for everyone)
--   * leaving the final class graduates the pupil into the archive
--   * this term's results are moved into academic_history first, so
--     the new class starts with a clean sheet and nothing is lost
--   * only the pupil's own class teacher, or an admin, may do it
-- ============================================================

create or replace function public.promote_student(p_student_id uuid)
returns table(previous_class text, new_class text, graduated boolean, archived_results int)
language plpgsql security definer set search_path = public as $$
declare
  -- The school's classes in order. Keep in step with CLASSES in
  -- src/lib/accounts.ts.
  v_classes text[] := array[
    'Daycare', 'Reception', 'Kindergarten 1', 'Kindergarten 2', 'Pre-Grade',
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'
  ];
  v_caller_role text := public.current_role();
  v_caller_class text := public.current_assigned_class();
  v_role text; v_grade text; v_graduated timestamptz;
  v_idx int; v_next text; v_is_final boolean;
  v_session text; v_archived int := 0;
  v_anchor date; v_year int;
begin
  select p.role, p.grade, p.graduated_at
    into v_role, v_grade, v_graduated
  from public.profiles p where p.id = p_student_id;

  if v_role is null then raise exception 'Pupil not found'; end if;
  if v_role <> 'student' then raise exception 'Only a pupil can be promoted'; end if;
  if v_graduated is not null then raise exception 'This pupil has already graduated'; end if;

  if v_caller_role = 'teacher' then
    if v_grade is distinct from v_caller_class then
      raise exception 'You can only promote pupils in your own class';
    end if;
  elsif v_caller_role <> 'admin' then
    raise exception 'Only a class teacher or an admin can promote a pupil';
  end if;

  v_idx := array_position(v_classes, v_grade);
  if v_idx is null then
    raise exception 'This pupil is not in a class yet, so there is no next class to move them to';
  end if;

  v_is_final := v_idx = array_length(v_classes, 1);
  v_next := case when v_is_final then 'Graduated' else v_classes[v_idx + 1] end;

  -- Prefer the session set on the Academic Calendar. It is often left
  -- blank, so fall back to the school year the term sits in rather
  -- than stamping a permanent record with "Unknown": the Nigerian
  -- school year runs Sept-July, so Sept onwards belongs to Y/Y+1.
  select nullif(btrim(ac.current_session), '') into v_session
  from public.academic_calendar ac where ac.id = 1;

  if v_session is null then
    select coalesce(ac.term_start_date, current_date) into v_anchor
    from public.academic_calendar ac where ac.id = 1;
    v_anchor := coalesce(v_anchor, current_date);
    v_year := extract(year from v_anchor)::int - case when extract(month from v_anchor) >= 9 then 0 else 1 end;
    v_session := v_year || '/' || (v_year + 1);
  end if;

  -- Archive this class's results, then clear them so the pupil starts
  -- the next class with an empty sheet.
  if exists (select 1 from public.results r where r.student_id = p_student_id) then
    insert into public.academic_history (student_id, grade, session, results)
    select p_student_id, v_grade, v_session, coalesce(jsonb_agg(to_jsonb(r) - 'student_id'), '[]'::jsonb)
    from public.results r
    where r.student_id = p_student_id;

    with removed as (
      delete from public.results r where r.student_id = p_student_id returning 1
    )
    select count(*) into v_archived from removed;
  end if;

  update public.profiles p
  set grade              = v_next,
      graduated_at       = case when v_is_final then now() else p.graduated_at end,
      final_class        = case when v_is_final then v_grade else p.final_class end,
      graduating_session = case when v_is_final then v_session else p.graduating_session end
  where p.id = p_student_id;

  return query select v_grade, v_next, v_is_final, v_archived;
end;
$$;

revoke all on function public.promote_student(uuid) from public;
grant execute on function public.promote_student(uuid) to authenticated;

notify pgrst, 'reload schema';
