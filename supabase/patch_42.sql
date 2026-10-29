-- ============================================================
-- Citadel Highflyers UMS -- patch 42
--
-- 1. Admin can mark attendance (and write attendance notes) for ANY
--    class, so a teacher without data/internet can be covered.
-- 2. Pinned messages in the class group chat (teacher of the class and
--    admin can pin / unpin; up to 3 stay pinned per class).
-- 3. Child-safe chat: a list of blocked words and emojis. A PUPIL's
--    message containing one is refused by the database (so it cannot be
--    bypassed). Teachers and admins are not restricted. The admin edits
--    the list from the class chat screen ("Blocked words").
-- 4. Teachers (their own class) and admins can delete group messages
--    (the policy already existed; the screen now has the button).
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Admin attendance
-- ------------------------------------------------------------
drop policy if exists "admins mark attendance" on public.attendance_records;
create policy "admins mark attendance"
  on public.attendance_records for insert
  with check (
    coalesce(public.current_role(), '') = 'admin'
    and marked_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student' and p.grade = class_name)
  );

drop policy if exists "admins update attendance" on public.attendance_records;
create policy "admins update attendance"
  on public.attendance_records for update
  using (coalesce(public.current_role(), '') = 'admin')
  with check (
    coalesce(public.current_role(), '') = 'admin'
    and marked_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student' and p.grade = class_name)
  );

drop policy if exists "admins manage attendance notes" on public.attendance_notes;
create policy "admins manage attendance notes"
  on public.attendance_notes for all
  using (coalesce(public.current_role(), '') = 'admin')
  with check (
    coalesce(public.current_role(), '') = 'admin'
    and updated_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student' and p.grade = class_name)
  );

-- ------------------------------------------------------------
-- 2. Pinned messages
-- ------------------------------------------------------------
alter table public.class_messages add column if not exists pinned_at timestamptz;
alter table public.class_messages add column if not exists pinned_by uuid references public.profiles(id) on delete set null;

create or replace function public.pin_class_message(p_id uuid, p_pin boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_class text;
  v_role text := coalesce(public.current_role(), '');
begin
  select class_name into v_class from public.class_messages where id = p_id;
  if v_class is null then raise exception 'Message not found'; end if;
  if v_role <> 'admin' and not (v_role = 'teacher' and public.my_class() = v_class) then
    raise exception 'Not allowed';
  end if;

  if p_pin then
    update public.class_messages set pinned_at = now(), pinned_by = auth.uid() where id = p_id;
    -- Keep at most 3 pinned per class: the oldest pin drops off.
    update public.class_messages set pinned_at = null, pinned_by = null
    where class_name = v_class and pinned_at is not null
      and id not in (
        select id from public.class_messages
        where class_name = v_class and pinned_at is not null
        order by pinned_at desc limit 3
      );
  else
    update public.class_messages set pinned_at = null, pinned_by = null where id = p_id;
  end if;
end;
$$;
revoke execute on function public.pin_class_message(uuid, boolean) from anon, public;
grant execute on function public.pin_class_message(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 3. Blocked words and emojis
-- ------------------------------------------------------------
create table if not exists public.blocked_terms (
  term text primary key,
  kind text not null check (kind in ('word', 'emoji')),
  created_at timestamptz not null default now()
);
alter table public.blocked_terms enable row level security;
grant select on public.blocked_terms to authenticated;
grant insert, update, delete on public.blocked_terms to authenticated;

drop policy if exists "signed-in users read blocked terms" on public.blocked_terms;
create policy "signed-in users read blocked terms"
  on public.blocked_terms for select
  using (auth.uid() is not null);

drop policy if exists "admins manage blocked terms" on public.blocked_terms;
create policy "admins manage blocked terms"
  on public.blocked_terms for all
  using (coalesce(public.current_role(), '') = 'admin')
  with check (coalesce(public.current_role(), '') = 'admin');

insert into public.blocked_terms (term, kind) values
  ('stupid', 'word'), ('idiot', 'word'), ('dumb', 'word'), ('dummy', 'word'), ('fool', 'word'),
  ('moron', 'word'), ('loser', 'word'), ('ugly', 'word'), ('fat', 'word'), ('mad', 'word'),
  ('crazy', 'word'), ('useless', 'word'), ('hate you', 'word'), ('shut up', 'word'), ('kill you', 'word'),
  ('shit', 'word'), ('fuck', 'word'), ('bitch', 'word'), ('bastard', 'word'), ('damn', 'word'),
  ('crap', 'word'), ('ass', 'word'), ('mumu', 'word'), ('olodo', 'word'), ('werey', 'word'), ('yeye', 'word'),
  ('💩', 'emoji'), ('🖕', 'emoji'), ('🍆', 'emoji'), ('🍑', 'emoji'), ('🤬', 'emoji'), ('🔫', 'emoji'), ('🔪', 'emoji')
on conflict (term) do nothing;

-- First blocked term found in some text, or null. Words match whole words
-- only ("mad" is caught, "made" is not); emojis match anywhere.
create or replace function public.first_blocked_term(p_text text)
returns text
language sql stable security definer set search_path = public as $$
  with norm as (select regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g') as txt)
  select t.term from public.blocked_terms t, norm
  where (t.kind = 'emoji' and position(t.term in norm.txt) > 0)
     or (t.kind = 'word' and norm.txt ~* ('\m' || regexp_replace(t.term, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M'))
  limit 1;
$$;
revoke execute on function public.first_blocked_term(text) from anon, public;
grant execute on function public.first_blocked_term(text) to authenticated;

-- Only pupils are restricted; teachers and admins may write anything
-- (e.g. a teacher explaining why a word is not allowed).
create or replace function public.enforce_clean_message()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_term text;
begin
  select role into v_role from public.profiles where id = new.sender_id;
  if v_role = 'student' then
    v_term := public.first_blocked_term(new.content);
    if v_term is not null then
      raise exception 'BLOCKED_CONTENT:%', v_term using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists class_messages_clean on public.class_messages;
create trigger class_messages_clean before insert on public.class_messages
  for each row execute function public.enforce_clean_message();

drop trigger if exists direct_messages_clean on public.direct_messages;
create trigger direct_messages_clean before insert on public.direct_messages
  for each row execute function public.enforce_clean_message();

notify pgrst, 'reload schema';
