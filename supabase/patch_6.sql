-- ============================================================
-- Citadel Highflyers UMS -- patch 6
-- Private (direct) messaging between a student and their class
-- teacher, or anyone and an admin.
--
-- Two parts:
--   1. Profile visibility: students currently can only SELECT their
--      own profiles row (see policies.sql), so they have no way to
--      even see their teacher's name/id to message them. This adds
--      the minimum extra visibility needed: a student can see the
--      teacher assigned to their own class, and everyone can see
--      admin profiles (school staff directory, not sensitive).
--   2. direct_messages: one row per message. RLS restricts reads to
--      the two participants and inserts to "as yourself" -- it does
--      NOT restrict *who* you can message (that's enforced by the
--      UI only showing sensible contacts), matching the app's
--      existing pattern of app-level contact lists.
-- ============================================================

create or replace function public.current_grade()
returns text
language sql stable security definer set search_path = public
as $$
  select grade from public.profiles where id = auth.uid();
$$;

drop policy if exists "students view their class teacher" on public.profiles;
create policy "students view their class teacher"
  on public.profiles for select
  using (
    public.current_role() = 'student'
    and role = 'teacher'
    and assigned_class = public.current_grade()
  );

drop policy if exists "everyone views admin profiles" on public.profiles;
create policy "everyone views admin profiles"
  on public.profiles for select
  using (role = 'admin');

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists direct_messages_participants_idx
  on public.direct_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);

alter table public.direct_messages enable row level security;
grant select, insert, update on public.direct_messages to authenticated;

drop policy if exists "users view their own conversations" on public.direct_messages;
create policy "users view their own conversations"
  on public.direct_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "users send messages as themselves" on public.direct_messages;
create policy "users send messages as themselves"
  on public.direct_messages for insert
  with check (auth.uid() = sender_id);

drop policy if exists "recipients mark messages read" on public.direct_messages;
create policy "recipients mark messages read"
  on public.direct_messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Live updates: lets the client subscribe to new messages via
-- Supabase Realtime instead of polling.
alter publication supabase_realtime add table public.direct_messages;
