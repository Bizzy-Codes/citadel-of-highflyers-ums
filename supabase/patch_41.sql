-- ============================================================
-- Citadel Highflyers UMS -- patch 41
--
-- 1. Push: one phone can be used by different accounts. Registering a
--    phone for the account that is logged in now takes it over from
--    whoever had it before (RLS alone refused that, so a second account
--    on the same phone never got notifications).
-- 2. Read receipts
--      * assignment_views: when a pupil opened an assignment.
--      * class_message_seen(): who has seen the class group chat, and
--        up to when.
--      (Private messages already have direct_messages.read_at.)
-- 3. One account per name: a second account with a name that is already
--    in the system is refused (by the database, so it cannot be bypassed),
--    and name_exists() lets the sign-up form say so politely first.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Register this phone / browser for the logged-in account
-- ------------------------------------------------------------
create or replace function public.register_push(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200));
end;
$$;
revoke execute on function public.register_push(text, text, text, text) from anon, public;
grant execute on function public.register_push(text, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 2a. Assignment read receipts
-- ------------------------------------------------------------
create table if not exists public.assignment_views (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);
alter table public.assignment_views enable row level security;
grant select, insert, update on public.assignment_views to authenticated;

drop policy if exists "students record their own views" on public.assignment_views;
create policy "students record their own views"
  on public.assignment_views for insert
  with check (
    student_id = auth.uid()
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.class_name = public.current_grade())
  );

drop policy if exists "students update their own views" on public.assignment_views;
create policy "students update their own views"
  on public.assignment_views for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "students read their own views" on public.assignment_views;
create policy "students read their own views"
  on public.assignment_views for select
  using (student_id = auth.uid());

drop policy if exists "teachers read views of their class" on public.assignment_views;
create policy "teachers read views of their class"
  on public.assignment_views for select
  using (
    public.current_role() = 'teacher'
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.class_name = public.current_assigned_class())
  );

drop policy if exists "admins read all views" on public.assignment_views;
create policy "admins read all views"
  on public.assignment_views for select
  using (coalesce(public.current_role(), '') = 'admin');

-- ------------------------------------------------------------
-- 2b. Who has seen the class group chat (and up to when)
-- ------------------------------------------------------------
create or replace function public.class_message_seen(p_class text)
returns table(user_id uuid, user_name text, last_read_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.current_role(), '') <> 'admin'
     and (coalesce(public.current_role(), '') not in ('student', 'teacher') or public.my_class() is distinct from p_class) then
    raise exception 'Not allowed';
  end if;
  return query
    select r.user_id, p.name, r.last_read_at
    from public.class_chat_reads r
    join public.profiles p on p.id = r.user_id
    where r.class_name = p_class
      and ((p.role = 'student' and p.grade = p_class) or (p.role = 'teacher' and p.assigned_class = p_class));
end;
$$;
revoke execute on function public.class_message_seen(text) from anon, public;
grant execute on function public.class_message_seen(text) to authenticated;

-- ------------------------------------------------------------
-- 3. One account per name
-- ------------------------------------------------------------
create or replace function public.normalize_person_name(p_name text)
returns text
language sql immutable as $$
  select lower(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
$$;

-- Used by the sign-up forms before they try to create anything. Only
-- says yes or no -- it never reveals whose account it is.
create or replace function public.name_exists(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where public.normalize_person_name(name) = public.normalize_person_name(p_name)
      and public.normalize_person_name(p_name) <> ''
  );
$$;
grant execute on function public.name_exists(text) to anon, authenticated;

create or replace function public.profiles_unique_name()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id <> new.id
      and public.normalize_person_name(p.name) = public.normalize_person_name(new.name)
  ) then
    raise exception 'DUPLICATE_NAME: an account with the name "%" already exists', new.name
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

-- Applies to new accounts, and to a name being changed. Accounts that
-- already share a name (from before this patch) are left alone.
drop trigger if exists profiles_unique_name_ins on public.profiles;
create trigger profiles_unique_name_ins before insert on public.profiles
  for each row execute function public.profiles_unique_name();
drop trigger if exists profiles_unique_name_upd on public.profiles;
create trigger profiles_unique_name_upd before update of name on public.profiles
  for each row when (new.name is distinct from old.name)
  execute function public.profiles_unique_name();

notify pgrst, 'reload schema';
