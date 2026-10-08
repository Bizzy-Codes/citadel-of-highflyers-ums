-- ============================================================
-- Citadel Highflyers UMS -- patch 38
--
-- 1. Notifications stop showing other people's personal notices.
--    The "admins manage notifications" policy was FOR ALL, which also
--    let every admin READ every row -- including each pupil's
--    "Welcome to Grade 2" and "Report card updated". It is now limited
--    to insert / update / delete; reading is only ever "addressed to
--    me, or a broadcast for my role".
-- 2. Announcements can carry a picture and a "pop up at login for N
--    days" period (notifications.image_url / popup_until).
-- 3. Admin-only feed: "NAME just created an account" and "NAME has
--    been placed in CLASS", as audience='admins' notices.
-- 4. Admins can upload / replace another person's profile photo.
-- 5. Teachers can reopen a terminated test for a pupil
--    (resume where they stopped, or start over).
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1 + 2. Notifications
-- ------------------------------------------------------------
alter table public.notifications add column if not exists image_url text;
alter table public.notifications add column if not exists popup_until timestamptz;

drop policy if exists "admins manage notifications" on public.notifications;
drop policy if exists "admins update notifications" on public.notifications;
drop policy if exists "admins delete notifications" on public.notifications;

create policy "admins update notifications"
  on public.notifications for update
  using (coalesce(public.current_role(), '') = 'admin')
  with check (coalesce(public.current_role(), '') = 'admin');

create policy "admins delete notifications"
  on public.notifications for delete
  using (coalesce(public.current_role(), '') = 'admin');

-- Announcement pictures: public bucket (every pupil / parent has to be
-- able to see them with a plain link). Staff upload, admins remove.
insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do nothing;

drop policy if exists "announcement images are publicly readable" on storage.objects;
create policy "announcement images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'announcement-images');

drop policy if exists "staff upload announcement images" on storage.objects;
create policy "staff upload announcement images"
  on storage.objects for insert
  with check (
    bucket_id = 'announcement-images'
    and coalesce(public.current_role(), '') in ('admin', 'teacher')
  );

drop policy if exists "admins remove announcement images" on storage.objects;
create policy "admins remove announcement images"
  on storage.objects for delete
  using (bucket_id = 'announcement-images' and coalesce(public.current_role(), '') = 'admin');

-- ------------------------------------------------------------
-- 3. Admin-only account activity notices
-- ------------------------------------------------------------
create or replace function public.notify_admins_new_profile()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.role in ('student', 'teacher_pending', 'teacher') then
      insert into public.notifications (title, message, type, audience)
      values (
        case when new.role = 'student' then 'New pupil account' else 'New staff account' end,
        coalesce(new.name, 'Someone') || ' just created an account on '
          || to_char(now() at time zone 'Africa/Lagos', 'DD Mon YYYY "at" HH12:MI AM') || '. '
          || case
               when new.role = 'student' and coalesce(new.grade, '') = '' then 'Still waiting to be assigned a class.'
               when new.role = 'student' then 'Class: ' || new.grade || '.'
               else 'Waiting for approval / a class.'
             end,
        'info',
        'admins'
      );
    end if;
  exception when others then
    null; -- never let a notice break sign-up
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_admins_new_profile on public.profiles;
create trigger trg_notify_admins_new_profile
  after insert on public.profiles
  for each row execute function public.notify_admins_new_profile();

create or replace function public.notify_admins_class_assigned()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.role = 'student'
       and coalesce(old.grade, '') = ''
       and coalesce(new.grade, '') <> '' then
      insert into public.notifications (title, message, type, audience)
      values (
        'Pupil placed in a class',
        coalesce(new.name, 'A pupil') || ' has been assigned to ' || new.grade || ' on '
          || to_char(now() at time zone 'Africa/Lagos', 'DD Mon YYYY "at" HH12:MI AM') || '.',
        'success',
        'admins'
      );
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_admins_class_assigned on public.profiles;
create trigger trg_notify_admins_class_assigned
  after update of grade on public.profiles
  for each row execute function public.notify_admins_class_assigned();

-- ------------------------------------------------------------
-- 4. Admin can set / replace / remove anyone's profile photo
-- ------------------------------------------------------------
drop policy if exists "admins upload any avatar" on storage.objects;
create policy "admins upload any avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and coalesce(public.current_role(), '') = 'admin');

drop policy if exists "admins replace any avatar" on storage.objects;
create policy "admins replace any avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and coalesce(public.current_role(), '') = 'admin');

-- ------------------------------------------------------------
-- 5. Reopen a terminated / expired test attempt
--    p_mode = 'resume'  -> back in progress with their answers kept, the
--                          strikes cleared, and the time they had left
--                          when it ended (at least 5 minutes).
--    p_mode = 'restart' -> answers wiped, strikes cleared, full time again.
--    To END it for good the teacher simply leaves it terminated.
-- ------------------------------------------------------------
create or replace function public.reopen_test_attempt(p_attempt_id uuid, p_mode text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(public.current_role(), '');
  v_test uuid; v_status text; v_started timestamptz; v_expires timestamptz; v_ended timestamptz;
  v_class text; v_duration int; v_left interval;
begin
  if v_role not in ('teacher', 'admin') then raise exception 'Not authorized'; end if;
  if p_mode not in ('resume', 'restart') then raise exception 'Unknown mode'; end if;

  select a.test_id, a.status, a.expires_at, a.submitted_at
    into v_test, v_status, v_expires, v_ended
  from public.test_attempts a where a.id = p_attempt_id;
  if v_test is null then raise exception 'Attempt not found'; end if;

  select t.class_name, t.duration_minutes into v_class, v_duration
  from public.tests t where t.id = v_test;

  if v_role = 'teacher' and v_class is distinct from public.current_assigned_class() then
    raise exception 'Not your class test';
  end if;
  if v_status = 'in_progress' then return; end if;
  if v_status = 'submitted' then raise exception 'This test was submitted, not terminated'; end if;

  if p_mode = 'restart' then
    delete from public.test_answers where attempt_id = p_attempt_id;
    update public.test_attempts
    set status = 'in_progress', started_at = now(),
        expires_at = now() + make_interval(mins => v_duration),
        submitted_at = null, terminated_reason = null, violation_count = 0, score = null
    where id = p_attempt_id;
  else
    v_left := greatest(coalesce(v_expires - v_ended, interval '0'), interval '5 minutes');
    update public.test_attempts
    set status = 'in_progress', expires_at = now() + v_left,
        submitted_at = null, terminated_reason = null, violation_count = 0, score = null
    where id = p_attempt_id;
  end if;
end;
$$;
revoke execute on function public.reopen_test_attempt(uuid, text) from anon, public;
grant execute on function public.reopen_test_attempt(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 6. School calendar shown as pictures on the page itself
-- ------------------------------------------------------------
alter table public.academic_calendar
  add column if not exists document_images jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
