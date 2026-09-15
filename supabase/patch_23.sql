-- ============================================================
-- Citadel Highflyers UMS -- patch 23
--
-- 1. Notifications stop leaking.
--    notifications had no recipient column at all and a policy of
--    `using (auth.uid() is not null)` -- so every signed-in user saw
--    every row ever written, including a teacher's "Report Card
--    Updated" landing in all 200 pupils' notification boxes. Rows now
--    carry a recipient (or an audience), and RLS enforces it.
--
-- 2. Admission payments record HOW they were paid.
--    Families now say up front whether they paid cash or by transfer,
--    so the office can reconcile cash at the desk instead of waiting
--    for a receipt upload that will never come.
--
-- 3. Recovers pupil details that never reached their profile.
--    Everyone admitted before the admit step started copying the
--    application across has a profile with empty bio/guardian fields,
--    while the data sits intact in admission_applications. This
--    backfills them by matching on email, and only ever fills a column
--    that is currently NULL -- it will not overwrite anything the
--    office has since typed in.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Notifications: who is this for?
-- ------------------------------------------------------------
alter table public.notifications add column if not exists recipient_id uuid
  references public.profiles(id) on delete cascade;
alter table public.notifications add column if not exists audience text
  not null default 'all';
alter table public.notifications add column if not exists created_by uuid
  references public.profiles(id) on delete set null;

alter table public.notifications drop constraint if exists notifications_audience_check;
alter table public.notifications add constraint notifications_audience_check
  check (audience in ('all', 'students', 'teachers', 'admins', 'direct'));

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

-- Existing rows are system chatter from before this patch (result
-- uploaded, report card updated, and so on). They were never meant to
-- be broadcast and there is no way to work out who they belonged to,
-- so retire them rather than leaving them visible to everyone.
delete from public.notifications where recipient_id is null and audience = 'all';

drop policy if exists "authenticated read notifications" on public.notifications;
drop policy if exists "staff write notifications" on public.notifications;
drop policy if exists "users read their own notifications" on public.notifications;
drop policy if exists "staff post notifications" on public.notifications;
drop policy if exists "admins manage notifications" on public.notifications;

-- A user sees a notification addressed to them personally, or a
-- broadcast aimed at everyone / at their role. Nothing else.
create policy "users read their own notifications"
  on public.notifications for select
  using (
    recipient_id = auth.uid()
    or (
      recipient_id is null
      and (
        audience = 'all'
        or (audience = 'students' and public.current_role() = 'student')
        or (audience = 'teachers' and public.current_role() in ('teacher', 'teacher_pending'))
        or (audience = 'admins'   and public.current_role() = 'admin')
      )
    )
  );

-- Only staff create notifications, and a teacher may only address a
-- pupil in their own class (or a broadcast, which the app restricts to
-- admins in the UI).
create policy "staff post notifications"
  on public.notifications for insert
  with check (
    public.current_role() in ('admin', 'teacher')
    and (
      recipient_id is null
      or public.current_role() = 'admin'
      or exists (
        select 1 from public.profiles p
        where p.id = recipient_id
          and p.role = 'student'
          and p.grade = public.current_assigned_class()
      )
    )
  );

create policy "admins manage notifications"
  on public.notifications for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ------------------------------------------------------------
-- 2. How the admission fee was paid.
-- ------------------------------------------------------------
alter table public.admission_applications add column if not exists payment_method text;

alter table public.admission_applications drop constraint if exists admission_applications_payment_method_check;
alter table public.admission_applications add constraint admission_applications_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'transfer'));

-- Anything already paid came in as a bank transfer with a receipt,
-- since that was the only route the form offered.
update public.admission_applications
set payment_method = 'transfer'
where payment_method is null and payment_status in ('submitted', 'confirmed');

-- submit_admission_payment now records the method and accepts a NULL
-- receipt, because a family paying cash at the desk has nothing to
-- upload -- the office confirms those by hand. Dropped and recreated
-- rather than overloaded so PostgREST resolves one clear signature.
drop function if exists public.submit_admission_payment(uuid, boolean, numeric, text);

create or replace function public.submit_admission_payment(
  p_application_id uuid,
  p_payment_method text,
  p_payment_amount numeric,
  p_payment_receipt_path text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_payment_method not in ('cash', 'transfer') then
    raise exception 'Payment method must be cash or transfer';
  end if;
  if p_payment_method = 'transfer' and coalesce(p_payment_receipt_path, '') = '' then
    raise exception 'A payment receipt is required for bank transfers';
  end if;

  update public.admission_applications
  set payment_method = p_payment_method,
      payment_amount = p_payment_amount,
      payment_receipt_path = p_payment_receipt_path,
      payment_status = 'submitted'
  where id = p_application_id and payment_status = 'unpaid';

  if not found then
    raise exception 'Application not found or payment already submitted';
  end if;
end;
$$;
grant execute on function public.submit_admission_payment(uuid, text, numeric, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 3. Recover pupil details from their admission application.
--
-- Matched on email (the admit step uses the application's email as the
-- login), newest application wins, and COALESCE means an existing
-- value on the profile always takes precedence. Safe to re-run.
-- ------------------------------------------------------------
with matched as (
  select distinct on (lower(a.email))
    lower(a.email) as email_key,
    a.id  as application_id,
    a.sex, a.date_of_birth, a.home_address, a.nationality, a.state_of_origin, a.lga,
    a.religion, a.blood_group, a.genotype,
    a.father_name, a.father_occupation, a.father_phone,
    a.mother_name, a.mother_occupation, a.mother_phone,
    a.pickup_person, a.pickup_phone,
    nullif(trim(both ' -' from concat_ws(' - ', nullif(a.health_challenge, ''), nullif(a.health_challenge_details, ''))), '') as health_notes
  from public.admission_applications a
  where a.email is not null and a.email <> ''
  order by lower(a.email), a.created_at desc
)
update public.profiles p
set admission_application_id = coalesce(p.admission_application_id, m.application_id),
    sex               = coalesce(p.sex, m.sex),
    date_of_birth     = coalesce(p.date_of_birth, m.date_of_birth),
    home_address      = coalesce(p.home_address, nullif(m.home_address, '')),
    nationality       = coalesce(p.nationality, nullif(m.nationality, '')),
    state_of_origin   = coalesce(p.state_of_origin, nullif(m.state_of_origin, '')),
    lga               = coalesce(p.lga, nullif(m.lga, '')),
    religion          = coalesce(p.religion, nullif(m.religion, '')),
    blood_group       = coalesce(p.blood_group, nullif(m.blood_group, '')),
    genotype          = coalesce(p.genotype, nullif(m.genotype, '')),
    health_notes      = coalesce(p.health_notes, m.health_notes),
    father_name       = coalesce(p.father_name, nullif(m.father_name, '')),
    father_occupation = coalesce(p.father_occupation, nullif(m.father_occupation, '')),
    father_phone      = coalesce(p.father_phone, nullif(m.father_phone, '')),
    mother_name       = coalesce(p.mother_name, nullif(m.mother_name, '')),
    mother_occupation = coalesce(p.mother_occupation, nullif(m.mother_occupation, '')),
    mother_phone      = coalesce(p.mother_phone, nullif(m.mother_phone, '')),
    pickup_person     = coalesce(p.pickup_person, nullif(m.pickup_person, '')),
    pickup_phone      = coalesce(p.pickup_phone, nullif(m.pickup_phone, '')),
    phone             = coalesce(p.phone, nullif(m.father_phone, ''), nullif(m.mother_phone, ''), nullif(m.pickup_phone, ''))
from matched m
where p.role = 'student'
  and p.email is not null
  and lower(p.email) = m.email_key;

-- ------------------------------------------------------------
-- 4. Class placement is the school's decision, not the pupil's.
--
-- A pupil signing up used to pick their own class from a dropdown,
-- which is how the register ends up full of children who put
-- themselves in Grade 5. They now register with no class at all and
-- can log in immediately; a teacher or admin places them afterwards.
--
-- This needs two SECURITY DEFINER helpers, because RLS deliberately
-- hides an unplaced pupil from teachers (the "teachers view students
-- in their class" policy matches on grade, and theirs is NULL) and
-- likewise blocks the very UPDATE that would place them.
-- ------------------------------------------------------------
create or replace function public.list_unassigned_students()
returns table(id uuid, display_id text, name text, email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() not in ('teacher', 'admin') then
    raise exception 'Not authorized';
  end if;

  return query
    select p.id, p.display_id, p.name, p.email, p.created_at
    from public.profiles p
    where p.role = 'student' and coalesce(p.grade, '') = ''
    order by p.created_at desc;
end;
$$;
grant execute on function public.list_unassigned_students() to authenticated;

create or replace function public.assign_student_to_class(p_student_id uuid, p_class text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text := public.current_role();
begin
  if v_role not in ('teacher', 'admin') then
    raise exception 'Not authorized';
  end if;
  -- A teacher may only pull a pupil into the class they actually teach.
  if v_role = 'teacher' and p_class is distinct from public.current_assigned_class() then
    raise exception 'You can only add pupils to your own class';
  end if;
  if coalesce(p_class, '') = '' then
    raise exception 'A class is required';
  end if;
  if not exists (select 1 from public.profiles where id = p_student_id and role = 'student') then
    raise exception 'Pupil not found';
  end if;

  update public.profiles set grade = p_class where id = p_student_id;
end;
$$;
grant execute on function public.assign_student_to_class(uuid, text) to authenticated;

notify pgrst, 'reload schema';
