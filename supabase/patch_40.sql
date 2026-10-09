-- ============================================================
-- Citadel Highflyers UMS -- patch 40
--
-- 1. Messaging: no more private pupil <-> teacher chats.
--      * Every class has ONE group chat (pupils + their class teacher;
--        admins can see and post in every class). What anyone posts, the
--        whole class sees.
--      * The only private chat anyone has is with an ADMIN. This is
--        enforced here in the database, not just hidden in the screen.
-- 2. Answer sheets for tests: each question can show the pupil an open
--    typing box ('box') or numbered lines i, ii, iii ... ('lines').
-- 3. Assignments: teachers can add questions, each with no answer sheet
--    (pupil writes in their notebook), a typing box, or roman-numeral
--    lines. Pupils type and save -- nothing is uploaded. Teachers read the
--    answers. Assignments can also be closed and re-published.
-- 4. Push notifications fire the moment something happens (new private
--    message, class group message, new/re-published assignment, test
--    published, announcement) via database triggers -> send-push.
-- 
-- Run once in the Supabase SQL editor. Safe to re-run.
-- Needs patch_39 (push_subscriptions, push_token, pg_net) already run.
-- ============================================================

-- ------------------------------------------------------------
-- helpers
-- ------------------------------------------------------------
-- The class a person belongs to: a pupil's grade, a teacher's assigned class.
create or replace function public.my_class()
returns text
language sql stable security definer set search_path = public
as $$
  select case role
           when 'student' then grade
           when 'teacher' then assigned_class
         end
  from public.profiles where id = auth.uid();
$$;
revoke execute on function public.my_class() from anon, public;
grant execute on function public.my_class() to authenticated;

-- ------------------------------------------------------------
-- 1a. Private messages: only with an admin
-- ------------------------------------------------------------
create or replace function public.is_admin_user(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_id and role = 'admin');
$$;
revoke execute on function public.is_admin_user(uuid) from anon, public;
grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists "users send messages as themselves" on public.direct_messages;
create policy "users send messages as themselves"
  on public.direct_messages for insert
  with check (
    auth.uid() = sender_id
    and (
      coalesce(public.current_role(), '') = 'admin'
      or public.is_admin_user(recipient_id)
    )
  );

-- Old pupil <-> teacher conversations are no longer readable by the
-- people in them; only conversations that involve an admin remain.
drop policy if exists "users view their own conversations" on public.direct_messages;
create policy "users view their own conversations"
  on public.direct_messages for select
  using (
    (auth.uid() = sender_id or auth.uid() = recipient_id)
    and (public.is_admin_user(sender_id) or public.is_admin_user(recipient_id))
  );

-- ------------------------------------------------------------
-- 1b. Class group chat
-- ------------------------------------------------------------
create table if not exists public.class_messages (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text,
  sender_role text,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists class_messages_class_idx on public.class_messages (class_name, created_at);

-- Name and role are stamped by the database so nobody can post "as" someone else.
create or replace function public.class_messages_stamp()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select name, role into new.sender_name, new.sender_role from public.profiles where id = new.sender_id;
  return new;
end;
$$;
drop trigger if exists class_messages_stamp_trg on public.class_messages;
create trigger class_messages_stamp_trg before insert on public.class_messages
  for each row execute function public.class_messages_stamp();

alter table public.class_messages enable row level security;
grant select, insert on public.class_messages to authenticated;
grant delete on public.class_messages to authenticated;

drop policy if exists "class members read their class chat" on public.class_messages;
create policy "class members read their class chat"
  on public.class_messages for select
  using (
    coalesce(public.current_role(), '') = 'admin'
    or (coalesce(public.current_role(), '') in ('student', 'teacher') and class_name = public.my_class())
  );

drop policy if exists "class members post in their class chat" on public.class_messages;
create policy "class members post in their class chat"
  on public.class_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      coalesce(public.current_role(), '') = 'admin'
      or (coalesce(public.current_role(), '') in ('student', 'teacher') and class_name = public.my_class())
    )
  );

drop policy if exists "admins and teachers remove class chat messages" on public.class_messages;
create policy "admins and teachers remove class chat messages"
  on public.class_messages for delete
  using (
    coalesce(public.current_role(), '') = 'admin'
    or (coalesce(public.current_role(), '') = 'teacher' and class_name = public.my_class())
  );

-- When each person last opened their class chat (for the unread badge).
create table if not exists public.class_chat_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_name text not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, class_name)
);
alter table public.class_chat_reads enable row level security;
grant select, insert, update on public.class_chat_reads to authenticated;
drop policy if exists "users manage their own chat read marks" on public.class_chat_reads;
create policy "users manage their own chat read marks"
  on public.class_chat_reads for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.class_messages;
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 2. Test answer sheets
-- ------------------------------------------------------------
alter table public.test_questions add column if not exists answer_mode text not null default 'box';
alter table public.test_questions drop constraint if exists test_questions_answer_mode_check;
alter table public.test_questions add constraint test_questions_answer_mode_check
  check (answer_mode in ('box', 'lines'));
alter table public.test_questions add column if not exists line_count int not null default 5;
alter table public.test_questions drop constraint if exists test_questions_line_count_check;
alter table public.test_questions add constraint test_questions_line_count_check
  check (line_count between 1 and 30);

drop function if exists public.get_attempt_questions(uuid);
create or replace function public.get_attempt_questions(p_attempt_id uuid)
returns table(
  question_id uuid, order_index int, type text, prompt text, points numeric,
  options jsonb, selected_option text, essay_text text,
  answer_mode text, line_count int
)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_status text;
begin
  perform public.finalize_expired_attempts();

  select ta.student_id, ta.status into v_owner, v_status from public.test_attempts ta where ta.id = p_attempt_id;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Not your attempt'; end if;
  if v_status <> 'in_progress' then raise exception 'This attempt is no longer active (status: %)', v_status; end if;

  return query
    select q.id, q.order_index, q.type, q.prompt, q.points, q.options, a.selected_option, a.essay_text,
           q.answer_mode, q.line_count
    from public.test_questions q
    left join public.test_answers a on a.question_id = q.id and a.attempt_id = p_attempt_id
    where q.test_id = (select ta2.test_id from public.test_attempts ta2 where ta2.id = p_attempt_id)
    order by q.order_index;
end;
$$;
revoke execute on function public.get_attempt_questions(uuid) from anon, public;
grant execute on function public.get_attempt_questions(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Assignments: open/closed, questions, typed answers
-- ------------------------------------------------------------
alter table public.assignments add column if not exists is_open boolean not null default true;

drop policy if exists "students view assignments for their class" on public.assignments;
create policy "students view assignments for their class"
  on public.assignments for select
  using (public.current_role() = 'student' and class_name = public.current_grade() and is_open);

create table if not exists public.assignment_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  order_index int not null default 0,
  prompt text not null,
  -- none: pupil copies it to their notebook; box: typing box; lines: i, ii, iii ...
  answer_mode text not null default 'none' check (answer_mode in ('none', 'box', 'lines')),
  line_count int not null default 5 check (line_count between 1 and 30),
  created_at timestamptz not null default now()
);
create index if not exists assignment_questions_idx on public.assignment_questions (assignment_id, order_index);

create table if not exists public.assignment_answers (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  question_id uuid not null references public.assignment_questions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answer_text text not null default '',
  updated_at timestamptz not null default now(),
  unique (question_id, student_id)
);
create index if not exists assignment_answers_assignment_idx on public.assignment_answers (assignment_id, student_id);

alter table public.assignment_questions enable row level security;
alter table public.assignment_answers enable row level security;
grant select, insert, update, delete on public.assignment_questions, public.assignment_answers to authenticated;

drop policy if exists "students view questions of their class assignments" on public.assignment_questions;
create policy "students view questions of their class assignments"
  on public.assignment_questions for select
  using (
    public.current_role() = 'student'
    and exists (select 1 from public.assignments a
                where a.id = assignment_id and a.class_name = public.current_grade() and a.is_open)
  );

drop policy if exists "teachers manage questions of their class assignments" on public.assignment_questions;
create policy "teachers manage questions of their class assignments"
  on public.assignment_questions for all
  using (
    public.current_role() = 'teacher'
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.class_name = public.current_assigned_class())
  )
  with check (
    public.current_role() = 'teacher'
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.class_name = public.current_assigned_class())
  );

drop policy if exists "admins full access to assignment_questions" on public.assignment_questions;
create policy "admins full access to assignment_questions"
  on public.assignment_questions for all
  using (coalesce(public.current_role(), '') = 'admin')
  with check (coalesce(public.current_role(), '') = 'admin');

drop policy if exists "students read own answers" on public.assignment_answers;
create policy "students read own answers"
  on public.assignment_answers for select
  using (student_id = auth.uid());

drop policy if exists "students write own answers while open" on public.assignment_answers;
create policy "students write own answers while open"
  on public.assignment_answers for insert
  with check (
    student_id = auth.uid()
    and exists (select 1 from public.assignments a
                where a.id = assignment_id and a.class_name = public.current_grade() and a.is_open)
  );

drop policy if exists "students update own answers while open" on public.assignment_answers;
create policy "students update own answers while open"
  on public.assignment_answers for update
  using (
    student_id = auth.uid()
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.is_open)
  )
  with check (student_id = auth.uid());

drop policy if exists "teachers read answers of their class" on public.assignment_answers;
create policy "teachers read answers of their class"
  on public.assignment_answers for select
  using (
    public.current_role() = 'teacher'
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.class_name = public.current_assigned_class())
  );

drop policy if exists "admins full access to assignment_answers" on public.assignment_answers;
create policy "admins full access to assignment_answers"
  on public.assignment_answers for all
  using (coalesce(public.current_role(), '') = 'admin')
  with check (coalesce(public.current_role(), '') = 'admin');

-- ------------------------------------------------------------
-- 4. Instant push notifications
--    A trigger asks the send-push Edge Function (same URL and token the
--    30-minute reminder job uses) to notify the right people. It never
--    blocks or fails the save that caused it.
-- ------------------------------------------------------------
create or replace function public.push_event(p_event text, p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://ubplmihazfynsfrlkhuo.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'event', p_event,
      'id', p_id,
      'token', (select value from public.ai_settings where key = 'push_token')
    ),
    timeout_milliseconds := 15000
  );
exception when others then
  raise warning 'push_event % failed: %', p_event, sqlerrm;
end;
$$;
revoke execute on function public.push_event(text, uuid) from anon, public, authenticated;

create or replace function public.trg_push_direct_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.push_event('direct_message', new.id); return new; end; $$;
drop trigger if exists push_direct_message on public.direct_messages;
create trigger push_direct_message after insert on public.direct_messages
  for each row execute function public.trg_push_direct_message();

create or replace function public.trg_push_class_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.push_event('class_message', new.id); return new; end; $$;
drop trigger if exists push_class_message on public.class_messages;
create trigger push_class_message after insert on public.class_messages
  for each row execute function public.trg_push_class_message();

create or replace function public.trg_push_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or (new.is_open and not old.is_open) then
    if new.is_open then perform public.push_event('assignment', new.id); end if;
  end if;
  return new;
end; $$;
drop trigger if exists push_assignment on public.assignments;
create trigger push_assignment after insert or update of is_open on public.assignments
  for each row execute function public.trg_push_assignment();

create or replace function public.trg_push_test() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.push_event('test', new.id);
  end if;
  return new;
end; $$;
drop trigger if exists push_test on public.tests;
create trigger push_test after insert or update of status on public.tests
  for each row execute function public.trg_push_test();

create or replace function public.trg_push_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.push_event('notification', new.id); return new; end; $$;
drop trigger if exists push_notification on public.notifications;
create trigger push_notification after insert on public.notifications
  for each row execute function public.trg_push_notification();

notify pgrst, 'reload schema';
