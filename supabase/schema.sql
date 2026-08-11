-- ============================================================
-- Citadel Highflyers UMS -- Supabase schema
-- Run once in: Supabase Dashboard -> SQL Editor -> New query
-- Run policies.sql immediately after this.
-- ============================================================

-- 1. Profiles: one row per authenticated user (student, teacher, admin)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_id text unique not null,        -- human-readable ID e.g. "CH 001", "CH-STAFF-01"
  name text not null,
  role text not null check (role in ('student', 'teacher', 'teacher_pending', 'admin')),
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  grade text,                              -- students only
  assigned_class text,                     -- teachers only
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- 2. Results
create table public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  score int not null check (score between 0 and 100),
  grade text not null,
  term text not null check (term in ('1st Term', '2nd Term', '3rd Term')),
  session text not null,
  created_at timestamptz not null default now()
);

-- 3. Academic history (snapshot written when a student is promoted)
create table public.academic_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  grade text not null,
  session text not null,
  results jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- 4. Subjects per class
create table public.class_subjects (
  class_name text primary key,
  subjects text[] not null default '{}'
);

-- 5. Timetable entries
create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  day text not null,
  time text not null,
  subject text not null,
  teacher text not null
);

-- 6. School-wide notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'warning', 'success')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Auto-create a profile row on signup (Supabase Auth -> auth.users).
-- Role comes from signup metadata, but a client can only ever request
-- 'student' or 'teacher'. Teacher requests land as 'teacher_pending'
-- and must be promoted to 'teacher' by an admin -- see policies.sql
-- and UserManagement's approval step. This closes the "anyone can
-- self-register as staff" hole in the current app.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  next_display_id text;
begin
  if requested_role not in ('student', 'teacher') then
    requested_role := 'student';
  end if;

  if requested_role = 'student' then
    select 'CH ' || lpad((count(*) + 1)::text, 3, '0') into next_display_id
    from public.profiles where role = 'student';

    insert into public.profiles (id, display_id, name, role, grade, email)
    values (
      new.id,
      next_display_id,
      coalesce(new.raw_user_meta_data->>'name', 'New User'),
      'student',
      new.raw_user_meta_data->>'grade',
      new.email
    );
  else
    select 'CH-STAFF-' || lpad((count(*) + 1)::text, 2, '0') into next_display_id
    from public.profiles where role in ('teacher', 'admin', 'teacher_pending');

    insert into public.profiles (id, display_id, name, role, email)
    values (
      new.id,
      next_display_id,
      coalesce(new.raw_user_meta_data->>'name', 'New User'),
      'teacher_pending',
      new.email
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
