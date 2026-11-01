-- ============================================================
-- Citadel Highflyers UMS -- patch 45
--
-- 1. WEEKEND SPOTLIGHT (fun weekend activity for every class)
--      Every weekend one pupil per class is drawn "raffle style" (nobody
--      is picked twice in a term until everyone has had a turn). They get
--      two random tasks that suit their class level -- show-and-tell with
--      a photo, a little research, "your best moment this week", and so
--      on. The task is shown to the whole class, the pupil answers with
--      text and/or a photo, and every classmate rates the answer 1-5 stars.
--      Keeping up with the ratings builds a weekend STREAK. At the end of
--      the term the class gets a "Memory Lane" of everything shared.
-- 2. SUBJECT TEACHERS (sub-teachers)
--      A teacher can be a "class teacher" (as before) or a "subject
--      teacher" who teaches some subjects in one or more classes. A
--      subject teacher can enter marks only for their own subjects, set
--      assignments and tests, and use the class chat.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- helpers
-- ------------------------------------------------------------
-- The Saturday that starts the weekend a date belongs to. Saturday and
-- Sunday belong to their own weekend; Monday-Friday point back at the
-- weekend just gone (so "last weekend's" spotlight is still visible).
create or replace function public.spotlight_weekend_of(d date)
returns date language sql immutable as $$
  select d - ((extract(dow from d)::int + 1) % 7);
$$;

-- Answers are accepted until the end of Sunday (Lagos time); classmates
-- can keep rating until the next Saturday begins.
create or replace function public.spotlight_submit_until(p_weekend date)
returns timestamptz language sql stable as $$
  select ((p_weekend + 2)::timestamp) at time zone 'Africa/Lagos';
$$;
create or replace function public.spotlight_rate_until(p_weekend date)
returns timestamptz language sql stable as $$
  select ((p_weekend + 7)::timestamp) at time zone 'Africa/Lagos';
$$;

-- Task difficulty band for a class.
create or replace function public.spotlight_band(p_class text)
returns text language sql immutable as $$
  select case
           when p_class in ('Grade 3', 'Grade 4', 'Grade 5') then 'upper'
           when p_class in ('Grade 1', 'Grade 2') then 'lower'
           else 'early'
         end;
$$;

-- May the signed-in person look at this class's spotlight?
create or replace function public.spotlight_can_access(p_class text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case coalesce(public.current_role(), '')
           when 'admin' then true
           when 'student' then p_class is not null and public.my_class() is not distinct from p_class
           when 'teacher' then p_class is not null and public.my_class() is not distinct from p_class
           else false
         end;
$$;
revoke execute on function public.spotlight_can_access(text) from anon, public;
grant execute on function public.spotlight_can_access(text) to authenticated;

create or replace function public.spotlight_is_staff_of(p_class text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case coalesce(public.current_role(), '')
           when 'admin' then true
           when 'teacher' then p_class is not null and public.my_class() is not distinct from p_class
           else false
         end;
$$;
revoke execute on function public.spotlight_is_staff_of(text) from anon, public;
grant execute on function public.spotlight_is_staff_of(text) to authenticated;

-- ------------------------------------------------------------
-- 1a. Tables
-- ------------------------------------------------------------
create table if not exists public.spotlight_tasks (
  id uuid primary key default gen_random_uuid(),
  prompt text not null check (char_length(prompt) between 5 and 500),
  kind text not null default 'fun'
    check (kind in ('show_and_tell', 'fun', 'learn', 'reflect', 'creative')),
  bands text[] not null default array['early', 'lower', 'upper'],
  needs_photo boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists spotlight_tasks_prompt_uq on public.spotlight_tasks (lower(prompt));

create table if not exists public.spotlight_rounds (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  weekend_date date not null,          -- the Saturday
  student_id uuid not null references public.profiles(id) on delete cascade,
  term text not null default '1st Term',
  session text not null default '',
  created_at timestamptz not null default now(),
  unique (class_name, weekend_date)
);
create index if not exists spotlight_rounds_class_idx on public.spotlight_rounds (class_name, weekend_date desc);

create table if not exists public.spotlight_entries (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.spotlight_rounds(id) on delete cascade,
  task_id uuid references public.spotlight_tasks(id) on delete set null,
  position int not null default 1,
  prompt text not null,                -- copied, so editing the bank never rewrites history
  kind text,
  needs_photo boolean not null default false,
  response_text text check (response_text is null or char_length(response_text) <= 3000),
  image_path text,
  submitted_at timestamptz,
  hidden boolean not null default false,
  unique (round_id, position)
);

create table if not exists public.spotlight_ratings (
  entry_id uuid not null references public.spotlight_entries(id) on delete cascade,
  rater_id uuid not null references public.profiles(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (entry_id, rater_id)
);

alter table public.spotlight_tasks enable row level security;
alter table public.spotlight_rounds enable row level security;
alter table public.spotlight_entries enable row level security;
alter table public.spotlight_ratings enable row level security;

-- Rounds, entries and ratings are read and written ONLY through the
-- functions below (no table policies on purpose), so a pupil can never
-- read raw ratings or edit someone else's answer.
revoke all on public.spotlight_rounds, public.spotlight_entries, public.spotlight_ratings from anon, authenticated;

-- The task bank: staff read it and add to it; only admins delete.
grant select, insert, update, delete on public.spotlight_tasks to authenticated;
drop policy if exists "staff read spotlight tasks" on public.spotlight_tasks;
create policy "staff read spotlight tasks" on public.spotlight_tasks for select
  using (coalesce(public.current_role(), '') in ('admin', 'teacher'));
drop policy if exists "staff add spotlight tasks" on public.spotlight_tasks;
create policy "staff add spotlight tasks" on public.spotlight_tasks for insert
  with check (coalesce(public.current_role(), '') in ('admin', 'teacher'));
drop policy if exists "staff edit spotlight tasks" on public.spotlight_tasks;
create policy "staff edit spotlight tasks" on public.spotlight_tasks for update
  using (coalesce(public.current_role(), '') in ('admin', 'teacher'))
  with check (coalesce(public.current_role(), '') in ('admin', 'teacher'));
drop policy if exists "admins delete spotlight tasks" on public.spotlight_tasks;
create policy "admins delete spotlight tasks" on public.spotlight_tasks for delete
  using (coalesce(public.current_role(), '') = 'admin');

-- ------------------------------------------------------------
-- 1b. Photos (private bucket; only the class can see them)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('spotlight-photos', 'spotlight-photos', false)
on conflict (id) do nothing;

create or replace function public.spotlight_can_view_photo(p_folder text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_round uuid; v_class text;
begin
  begin v_round := p_folder::uuid; exception when others then return false; end;
  select class_name into v_class from public.spotlight_rounds where id = v_round;
  if v_class is null then return false; end if;
  return public.spotlight_can_access(v_class);
end;
$$;
revoke execute on function public.spotlight_can_view_photo(text) from anon, public;
grant execute on function public.spotlight_can_view_photo(text) to authenticated;

create or replace function public.spotlight_can_upload_photo(p_folder text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_round uuid; v_pupil uuid; v_wk date;
begin
  begin v_round := p_folder::uuid; exception when others then return false; end;
  select student_id, weekend_date into v_pupil, v_wk from public.spotlight_rounds where id = v_round;
  return v_pupil is not null and v_pupil = auth.uid() and now() < public.spotlight_submit_until(v_wk);
end;
$$;
revoke execute on function public.spotlight_can_upload_photo(text) from anon, public;
grant execute on function public.spotlight_can_upload_photo(text) to authenticated;

drop policy if exists "class members view spotlight photos" on storage.objects;
create policy "class members view spotlight photos" on storage.objects for select
  using (bucket_id = 'spotlight-photos' and public.spotlight_can_view_photo((storage.foldername(name))[1]));

drop policy if exists "spotlight pupil uploads photos" on storage.objects;
create policy "spotlight pupil uploads photos" on storage.objects for insert
  with check (bucket_id = 'spotlight-photos' and public.spotlight_can_upload_photo((storage.foldername(name))[1]));

drop policy if exists "spotlight pupil or admin removes photos" on storage.objects;
create policy "spotlight pupil or admin removes photos" on storage.objects for delete
  using (
    bucket_id = 'spotlight-photos'
    and (public.spotlight_can_upload_photo((storage.foldername(name))[1])
         or coalesce(public.current_role(), '') = 'admin')
  );

-- ------------------------------------------------------------
-- 1c. The draw
-- ------------------------------------------------------------
create or replace function public.spotlight_draw(p_class text, p_weekend date, p_exclude uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_pupil uuid; v_pupil_name text;
  v_term text; v_session text; v_band text := public.spotlight_band(p_class);
  t1_id uuid; t1_prompt text; t1_kind text; t1_photo boolean;
  t2_id uuid; t2_prompt text; t2_kind text; t2_photo boolean;
begin
  perform pg_advisory_xact_lock(hashtext('spotlight:' || coalesce(p_class, '')));

  select id into v_id from public.spotlight_rounds where class_name = p_class and weekend_date = p_weekend;
  if v_id is not null then return v_id; end if;

  select coalesce(nullif(btrim(current_term), ''), '1st Term'), coalesce(btrim(current_session), '')
    into v_term, v_session
  from public.academic_calendar where id = 1;
  v_term := coalesce(v_term, '1st Term');
  v_session := coalesce(v_session, '');

  -- Raffle without putting names back: everyone gets a turn before anyone
  -- gets a second one this term.
  select p.id, p.name into v_pupil, v_pupil_name
  from public.profiles p
  where p.role = 'student' and p.grade = p_class
    and coalesce(p.status, 'Active') = 'Active' and p.graduated_at is null
    and (p_exclude is null or p.id <> p_exclude)
    and not exists (
      select 1 from public.spotlight_rounds r
      where r.class_name = p_class and r.student_id = p.id and r.term = v_term and r.session = v_session)
  order by random() limit 1;

  if v_pupil is null then
    select p.id, p.name into v_pupil, v_pupil_name
    from public.profiles p
    where p.role = 'student' and p.grade = p_class
      and coalesce(p.status, 'Active') = 'Active' and p.graduated_at is null
      and (p_exclude is null or p.id <> p_exclude)
    order by random() limit 1;
  end if;
  if v_pupil is null then return null; end if;

  -- First task: not one this pupil has had, nor one the class had lately.
  select t.id, t.prompt, t.kind, t.needs_photo into t1_id, t1_prompt, t1_kind, t1_photo
  from public.spotlight_tasks t
  where t.active and v_band = any (t.bands)
    and not exists (
      select 1 from public.spotlight_entries e join public.spotlight_rounds r on r.id = e.round_id
      where e.task_id = t.id and (r.student_id = v_pupil or (r.class_name = p_class and r.weekend_date > p_weekend - 70)))
  order by random() limit 1;
  if t1_id is null then
    select t.id, t.prompt, t.kind, t.needs_photo into t1_id, t1_prompt, t1_kind, t1_photo
    from public.spotlight_tasks t where t.active and v_band = any (t.bands)
    order by random() limit 1;
  end if;
  if t1_id is null then return null; end if;

  -- Second task: a different kind of activity, so the two feel different.
  select t.id, t.prompt, t.kind, t.needs_photo into t2_id, t2_prompt, t2_kind, t2_photo
  from public.spotlight_tasks t
  where t.active and v_band = any (t.bands) and t.id <> t1_id and t.kind <> t1_kind
    and not exists (
      select 1 from public.spotlight_entries e join public.spotlight_rounds r on r.id = e.round_id
      where e.task_id = t.id and (r.student_id = v_pupil or (r.class_name = p_class and r.weekend_date > p_weekend - 70)))
  order by random() limit 1;
  if t2_id is null then
    select t.id, t.prompt, t.kind, t.needs_photo into t2_id, t2_prompt, t2_kind, t2_photo
    from public.spotlight_tasks t
    where t.active and v_band = any (t.bands) and t.id <> t1_id and t.kind <> t1_kind
    order by random() limit 1;
  end if;
  if t2_id is null then
    select t.id, t.prompt, t.kind, t.needs_photo into t2_id, t2_prompt, t2_kind, t2_photo
    from public.spotlight_tasks t
    where t.active and v_band = any (t.bands) and t.id <> t1_id
    order by random() limit 1;
  end if;

  insert into public.spotlight_rounds (class_name, weekend_date, student_id, term, session)
  values (p_class, p_weekend, v_pupil, v_term, v_session)
  returning id into v_id;

  insert into public.spotlight_entries (round_id, task_id, position, prompt, kind, needs_photo)
  values (v_id, t1_id, 1, t1_prompt, t1_kind, t1_photo);
  if t2_id is not null then
    insert into public.spotlight_entries (round_id, task_id, position, prompt, kind, needs_photo)
    values (v_id, t2_id, 2, t2_prompt, t2_kind, t2_photo);
  end if;

  -- Tell the class (these also arrive as phone notifications).
  begin
    insert into public.notifications (title, message, type, audience, recipient_id)
    select
      case when p.id = v_pupil then 'You are in the Spotlight!' else 'Weekend Spotlight' end,
      case when p.id = v_pupil
           then 'You have been picked for this weekend''s Spotlight. Open Spotlight in your class chat to see your tasks!'
           else v_pupil_name || ' is in the Spotlight this weekend! Cheer them on, then come and rate their tasks.' end,
      'info', 'direct', p.id
    from public.profiles p
    where p.role = 'student' and p.grade = p_class
      and coalesce(p.status, 'Active') = 'Active' and p.graduated_at is null;
  exception when others then
    null; -- a notice must never stop the draw
  end;

  return v_id;
end;
$$;
revoke execute on function public.spotlight_draw(text, date, uuid) from anon, public, authenticated;

-- ------------------------------------------------------------
-- 1d. Reading a round (one place builds the picture everyone sees)
-- ------------------------------------------------------------
create or replace function public.spotlight_round_json(p_round uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.spotlight_rounds%rowtype;
  v_me uuid := auth.uid();
  v_staff boolean;
  v_phase text; v_entries jsonb; v_pending jsonb := '[]'::jsonb;
  v_submit timestamptz; v_rate timestamptz;
  v_total int := 0; v_missing int := 0;
  v_name text; v_avatar text;
begin
  select * into r from public.spotlight_rounds where id = p_round;
  if not found then return null; end if;
  v_staff := public.spotlight_is_staff_of(r.class_name);
  v_submit := public.spotlight_submit_until(r.weekend_date);
  v_rate := public.spotlight_rate_until(r.weekend_date);
  v_phase := case when now() < v_submit then 'open' when now() < v_rate then 'rating' else 'closed' end;

  select jsonb_agg(jsonb_build_object(
      'id', e.id, 'position', e.position, 'prompt', e.prompt, 'kind', e.kind,
      'needs_photo', e.needs_photo,
      'submitted', e.submitted_at is not null, 'submitted_at', e.submitted_at,
      'hidden', e.hidden,
      'response_text', case when e.hidden and not v_staff then null else e.response_text end,
      'image_path', case when e.hidden and not v_staff then null else e.image_path end,
      'avg', (select round(avg(x.stars)::numeric, 1) from public.spotlight_ratings x where x.entry_id = e.id),
      'count', (select count(*) from public.spotlight_ratings x where x.entry_id = e.id),
      'my_stars', (select x.stars from public.spotlight_ratings x where x.entry_id = e.id and x.rater_id = v_me)
    ) order by e.position)
  into v_entries
  from public.spotlight_entries e where e.round_id = r.id;

  select p.name, p.avatar_url into v_name, v_avatar from public.profiles p where p.id = r.student_id;

  -- Classmates who still owe a rating (the pupil in the spotlight does not rate themselves).
  with owed as (
    select p.name
    from public.profiles p
    where p.role = 'student' and p.grade = r.class_name and p.id <> r.student_id
      and coalesce(p.status, 'Active') = 'Active' and p.graduated_at is null
      and exists (
        select 1 from public.spotlight_entries e
        where e.round_id = r.id and e.submitted_at is not null and not e.hidden
          and not exists (select 1 from public.spotlight_ratings x where x.entry_id = e.id and x.rater_id = p.id))
  )
  select count(*), coalesce(jsonb_agg(name order by name), '[]'::jsonb) into v_missing, v_pending from owed;

  select count(*) into v_total
  from public.profiles p
  where p.role = 'student' and p.grade = r.class_name and p.id <> r.student_id
    and coalesce(p.status, 'Active') = 'Active' and p.graduated_at is null;

  return jsonb_build_object(
    'id', r.id, 'class_name', r.class_name, 'weekend_date', r.weekend_date,
    'term', r.term, 'session', r.session,
    'submit_until', v_submit, 'rate_until', v_rate, 'phase', v_phase,
    'student', jsonb_build_object('id', r.student_id, 'name', v_name, 'avatar_url', v_avatar),
    'is_me', r.student_id = v_me,
    'entries', coalesce(v_entries, '[]'::jsonb),
    'raters_total', v_total,
    'raters_missing', v_missing,
    'pending_raters', case when v_staff then v_pending else '[]'::jsonb end
  );
end;
$$;
revoke execute on function public.spotlight_round_json(uuid) from anon, public, authenticated;

-- This weekend's round for a class. On a Saturday or Sunday the first
-- person to look draws it (so nothing needs a scheduler). Teachers and
-- admins can also start one on a weekday (p_force) -- handy for a trial.
create or replace function public.spotlight_current(p_class text, p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_wk date := public.spotlight_weekend_of((now() at time zone 'Africa/Lagos')::date);
  v_id uuid; v_weekend boolean;
  v_tasks int;
begin
  if not public.spotlight_can_access(p_class) then raise exception 'Not allowed'; end if;
  v_weekend := extract(dow from v_today) in (6, 0);

  select id into v_id from public.spotlight_rounds where class_name = p_class and weekend_date = v_wk;
  if v_id is null and (v_weekend or (p_force and public.spotlight_is_staff_of(p_class))) then
    v_id := public.spotlight_draw(p_class, v_wk, null);
  end if;
  if v_id is null then
    select id into v_id from public.spotlight_rounds where class_name = p_class order by weekend_date desc limit 1;
  end if;

  select count(*) into v_tasks from public.spotlight_tasks t
   where t.active and public.spotlight_band(p_class) = any (t.bands);

  return jsonb_build_object(
    'round', case when v_id is null then null else public.spotlight_round_json(v_id) end,
    'is_weekend', v_weekend,
    'this_weekend', v_wk,
    'tasks_available', v_tasks,
    'is_staff', public.spotlight_is_staff_of(p_class)
  );
end;
$$;
revoke execute on function public.spotlight_current(text, boolean) from anon, public;
grant execute on function public.spotlight_current(text, boolean) to authenticated;

-- ------------------------------------------------------------
-- 1e. Answering, rating, moderating
-- ------------------------------------------------------------
create or replace function public.spotlight_submit(p_entry uuid, p_text text, p_image_path text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  e public.spotlight_entries%rowtype;
  r public.spotlight_rounds%rowtype;
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
  v_image text := nullif(btrim(coalesce(p_image_path, '')), '');
  v_term text; v_first boolean; v_name text;
begin
  select * into e from public.spotlight_entries where id = p_entry;
  if not found then raise exception 'Task not found'; end if;
  select * into r from public.spotlight_rounds where id = e.round_id;
  if r.student_id is distinct from auth.uid() then raise exception 'These tasks belong to someone else'; end if;
  if now() >= public.spotlight_submit_until(r.weekend_date) then
    raise exception 'The weekend is over, so answers are closed now';
  end if;
  if v_text is null and v_image is null and e.image_path is null then
    raise exception 'Write something or add a photo first';
  end if;
  if e.needs_photo and v_image is null and e.image_path is null then
    raise exception 'This task needs a photo';
  end if;
  if v_image is not null and v_image not like r.id::text || '/%' then
    raise exception 'Bad photo';
  end if;

  if v_text is not null then
    v_term := public.first_blocked_term(v_text);
    if v_term is not null then
      raise exception 'BLOCKED_CONTENT:%', v_term using errcode = 'check_violation';
    end if;
  end if;

  select not exists (
    select 1 from public.spotlight_entries x where x.round_id = r.id and x.submitted_at is not null
  ) into v_first;

  update public.spotlight_entries
     set response_text = v_text,
         image_path = coalesce(v_image, image_path),
         submitted_at = coalesce(submitted_at, now())
   where id = e.id;

  -- The first answer of the weekend tells the class it is ready to rate.
  if v_first then
    begin
      select name into v_name from public.profiles where id = r.student_id;
      insert into public.notifications (title, message, type, audience, recipient_id)
      select 'Spotlight is ready to rate',
             coalesce(v_name, 'Your classmate') || ' has shared their Spotlight! Come and give them your stars.',
             'info', 'direct', p.id
      from public.profiles p
      where p.role = 'student' and p.grade = r.class_name and p.id <> r.student_id
        and coalesce(p.status, 'Active') = 'Active' and p.graduated_at is null;
    exception when others then null;
    end;
  end if;
end;
$$;
revoke execute on function public.spotlight_submit(uuid, text, text) from anon, public;
grant execute on function public.spotlight_submit(uuid, text, text) to authenticated;

create or replace function public.spotlight_rate(p_entry uuid, p_stars int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  e public.spotlight_entries%rowtype;
  r public.spotlight_rounds%rowtype;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'Pick 1 to 5 stars'; end if;
  if coalesce(public.current_role(), '') <> 'student' then raise exception 'Only pupils rate the Spotlight'; end if;
  select * into e from public.spotlight_entries where id = p_entry;
  if not found then raise exception 'Task not found'; end if;
  select * into r from public.spotlight_rounds where id = e.round_id;
  if public.my_class() is distinct from r.class_name then raise exception 'This is not your class'; end if;
  if r.student_id = auth.uid() then raise exception 'You cannot rate your own answer'; end if;
  if e.submitted_at is null or e.hidden then raise exception 'There is nothing to rate yet'; end if;
  if now() >= public.spotlight_rate_until(r.weekend_date) then raise exception 'Rating for this weekend has closed'; end if;

  insert into public.spotlight_ratings (entry_id, rater_id, stars)
  values (e.id, auth.uid(), p_stars)
  on conflict (entry_id, rater_id) do update set stars = excluded.stars, created_at = now();
end;
$$;
revoke execute on function public.spotlight_rate(uuid, int) from anon, public;
grant execute on function public.spotlight_rate(uuid, int) to authenticated;

create or replace function public.spotlight_hide_entry(p_entry uuid, p_hide boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_class text;
begin
  select r.class_name into v_class
  from public.spotlight_entries e join public.spotlight_rounds r on r.id = e.round_id
  where e.id = p_entry;
  if v_class is null then raise exception 'Task not found'; end if;
  if not public.spotlight_is_staff_of(v_class) then raise exception 'Only the class teacher or an admin can do this'; end if;
  update public.spotlight_entries set hidden = coalesce(p_hide, true) where id = p_entry;
end;
$$;
revoke execute on function public.spotlight_hide_entry(uuid, boolean) from anon, public;
grant execute on function public.spotlight_hide_entry(uuid, boolean) to authenticated;

-- Pick someone else (e.g. the pupil is away) -- only before anything was shared.
create or replace function public.spotlight_redraw(p_round uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.spotlight_rounds%rowtype; v_new uuid;
begin
  select * into r from public.spotlight_rounds where id = p_round;
  if not found then raise exception 'Round not found'; end if;
  if not public.spotlight_is_staff_of(r.class_name) then raise exception 'Only the class teacher or an admin can do this'; end if;
  if exists (select 1 from public.spotlight_entries where round_id = r.id and submitted_at is not null) then
    raise exception 'Something has already been shared, so this draw can no longer change';
  end if;
  delete from public.spotlight_rounds where id = r.id;
  v_new := public.spotlight_draw(r.class_name, r.weekend_date, r.student_id);
  if v_new is null then raise exception 'There is nobody else in this class to pick'; end if;
  return v_new;
end;
$$;
revoke execute on function public.spotlight_redraw(uuid) from anon, public;
grant execute on function public.spotlight_redraw(uuid) to authenticated;

-- ------------------------------------------------------------
-- 1f. Streaks and the class board
-- ------------------------------------------------------------
-- A pupil "completes" a weekend by rating every answer shared (or, if
-- they were in the Spotlight, by sharing one). Weekends nobody shared
-- anything are skipped; a weekend still open for rating never breaks a
-- streak, it just hasn't counted yet.
create or replace function public.spotlight_leaderboard(p_class text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p record; rd record;
  v_run int; v_best int; v_done boolean;
  v_out jsonb := '[]'::jsonb;
  v_spot int; v_avg numeric; v_given int; v_me uuid := auth.uid();
begin
  if not public.spotlight_can_access(p_class) then raise exception 'Not allowed'; end if;

  for p in
    select id, name, avatar_url, created_at from public.profiles
    where role = 'student' and grade = p_class
      and coalesce(status, 'Active') = 'Active' and graduated_at is null
    order by name
  loop
    v_run := 0; v_best := 0;
    for rd in
      select r.id, r.student_id, r.weekend_date
      from public.spotlight_rounds r
      where r.class_name = p_class
        and r.created_at >= p.created_at - interval '1 day'
        and exists (select 1 from public.spotlight_entries e where e.round_id = r.id and e.submitted_at is not null and not e.hidden)
      order by r.weekend_date
    loop
      if rd.student_id = p.id then
        v_done := true;
      else
        v_done := not exists (
          select 1 from public.spotlight_entries e
          where e.round_id = rd.id and e.submitted_at is not null and not e.hidden
            and not exists (select 1 from public.spotlight_ratings x where x.entry_id = e.id and x.rater_id = p.id));
      end if;
      if v_done then
        v_run := v_run + 1;
        if v_run > v_best then v_best := v_run; end if;
      elsif public.spotlight_rate_until(rd.weekend_date) > now() then
        null; -- still time to catch up
      else
        v_run := 0;
      end if;
    end loop;

    select count(*) into v_spot from public.spotlight_rounds r where r.class_name = p_class and r.student_id = p.id;
    select round(avg(x.stars)::numeric, 1) into v_avg
      from public.spotlight_ratings x
      join public.spotlight_entries e on e.id = x.entry_id and not e.hidden
      join public.spotlight_rounds r on r.id = e.round_id
     where r.class_name = p_class and r.student_id = p.id;
    select count(*) into v_given
      from public.spotlight_ratings x
      join public.spotlight_entries e on e.id = x.entry_id
      join public.spotlight_rounds r on r.id = e.round_id
     where r.class_name = p_class and x.rater_id = p.id;

    v_out := v_out || jsonb_build_object(
      'id', p.id, 'name', p.name, 'avatar_url', p.avatar_url,
      'streak', v_run, 'best_streak', v_best,
      'spotlighted', v_spot, 'avg_received', v_avg, 'ratings_given', v_given,
      'is_me', p.id = v_me);
  end loop;
  return v_out;
end;
$$;
revoke execute on function public.spotlight_leaderboard(text) from anon, public;
grant execute on function public.spotlight_leaderboard(text) to authenticated;

-- ------------------------------------------------------------
-- 1g. Memory Lane: everything shared in a term
-- ------------------------------------------------------------
create or replace function public.spotlight_memory_lane(p_class text, p_term text default null, p_session text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_terms jsonb; v_term text := p_term; v_session text := p_session; v_rounds jsonb;
begin
  if not public.spotlight_can_access(p_class) then raise exception 'Not allowed'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'term', s.term, 'session', s.session, 'rounds', s.n, 'first', s.first_day, 'last', s.last_day
         ) order by s.last_day desc), '[]'::jsonb)
    into v_terms
  from (
    select term, session, count(*) as n, min(weekend_date) as first_day, max(weekend_date) as last_day
    from public.spotlight_rounds where class_name = p_class group by term, session
  ) s;

  if v_term is null then
    select r.term, r.session into v_term, v_session
    from public.spotlight_rounds r where r.class_name = p_class
    order by r.weekend_date desc limit 1;
  end if;

  select coalesce(jsonb_agg(public.spotlight_round_json(r.id) order by r.weekend_date), '[]'::jsonb)
    into v_rounds
  from public.spotlight_rounds r
  where r.class_name = p_class and r.term = v_term and r.session = coalesce(v_session, '')
    and exists (select 1 from public.spotlight_entries e where e.round_id = r.id and e.submitted_at is not null and not e.hidden);

  return jsonb_build_object('terms', v_terms, 'term', v_term, 'session', coalesce(v_session, ''), 'rounds', v_rounds);
end;
$$;
revoke execute on function public.spotlight_memory_lane(text, text, text) from anon, public;
grant execute on function public.spotlight_memory_lane(text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 1h. Starter tasks (staff can add, switch off or delete more)
--     bands: early = Daycare..Pre-Grade (a grown-up helps), lower = Grade 1-2,
--     upper = Grade 3-5
-- ------------------------------------------------------------
insert into public.spotlight_tasks (prompt, kind, bands, needs_photo)
select v.prompt, v.kind, v.bands, v.needs_photo
from (values
  -- show and tell
  ('Take a photo of your favourite toy and tell the class why you love it.', 'show_and_tell', array['early','lower','upper'], true),
  ('Snap a picture of your pet (or a pet you would love to have) and tell us one fun thing about it.', 'show_and_tell', array['early','lower','upper'], true),
  ('Show us your favourite book and tell us what it is about in two or three sentences.', 'show_and_tell', array['lower','upper'], true),
  ('Take a picture of your favourite food and tell us why you love it.', 'show_and_tell', array['early','lower','upper'], true),
  ('Show us a drawing or craft you made, and tell us how you made it.', 'show_and_tell', array['early','lower','upper'], true),
  ('Take a photo of something blue in your home and make up a short story about it.', 'show_and_tell', array['lower','upper'], true),
  ('Photograph your favourite spot at home or in your compound (no faces, please) and tell us why you love it.', 'show_and_tell', array['early','lower','upper'], true),
  ('Show us your pencil case or school bag. What is the most useful thing inside, and why?', 'show_and_tell', array['lower','upper'], true),
  ('Take a picture of a plant or tree near you. What do you think it is called, and what is it used for?', 'show_and_tell', array['lower','upper'], true),
  ('Make something out of old boxes, bottles or paper (something that would normally be thrown away) and show us!', 'show_and_tell', array['upper'], true),
  ('With a grown-up, take a photo of five of your toys lined up and count them out loud together.', 'show_and_tell', array['early'], true),
  ('With a grown-up, take a photo of something red and tell us its name.', 'show_and_tell', array['early'], true),
  -- fun
  ('Teach us the words of a song you love and tell us why you like it.', 'fun', array['lower','upper'], false),
  ('Tell the class a joke or riddle that will make everyone laugh. Do not forget the answer!', 'fun', array['lower','upper'], false),
  ('If you could have any superpower for one day, what would it be and what would you do with it?', 'fun', array['lower','upper'], false),
  ('Invent a new animal that is half lion and half butterfly. What is its name and what does it do?', 'fun', array['early','lower','upper'], false),
  ('Describe your dream birthday party. Who comes, what do you eat, and what games do you play?', 'fun', array['lower','upper'], false),
  ('Teach us how to play your favourite game with friends.', 'fun', array['lower','upper'], false),
  ('Who is your favourite cartoon character? Tell us what you love about them.', 'fun', array['early','lower','upper'], false),
  ('Invent a brand new snack. What is it called, and what does it taste like?', 'fun', array['lower','upper'], false),
  ('If you were the teacher for one day, what would you teach everybody?', 'fun', array['lower','upper'], false),
  ('If you could visit any country for a day, where would you go and why?', 'fun', array['upper'], false),
  ('With a grown-up, say your favourite rhyme or song, and type its name for us.', 'fun', array['early'], false),
  ('What is your favourite animal, and what sound does it make?', 'fun', array['early'], false),
  -- reflect (about school life)
  ('What was your best moment in school this week? Tell us what happened and why you enjoyed it.', 'reflect', array['early','lower','upper'], false),
  ('Tell the class something you learned this week that surprised you.', 'reflect', array['lower','upper'], false),
  ('Say a big thank you! Pick a classmate or teacher who was kind to you this week and tell us what they did.', 'reflect', array['early','lower','upper'], false),
  ('Write three things you are proud of from this week.', 'reflect', array['lower','upper'], false),
  ('Explain one thing you learned in class this week as if you were the teacher.', 'reflect', array['lower','upper'], false),
  ('What was hard for you this week, and how did you handle it?', 'reflect', array['upper'], false),
  ('What is your favourite lesson this term, and why?', 'reflect', array['early','lower','upper'], false),
  -- learn
  ('Do a little research on photosynthesis. In your own words, explain how plants make their food. Add a photo or screenshot to show where you read about it.', 'learn', array['upper'], true),
  ('Find out how the water cycle works and explain it in your own words. Add a photo or screenshot of your notes.', 'learn', array['upper'], true),
  ('Choose an animal and find out where it lives, what it eats and one amazing fact. Add a photo of your notes or a drawing.', 'learn', array['upper'], true),
  ('Research one famous Nigerian (an inventor, scientist, athlete or leader) and tell us why they are important.', 'learn', array['upper'], false),
  ('Pick a planet and find three interesting facts about it to share with us.', 'learn', array['upper'], false),
  ('Find out what causes day and night, and explain it in your own words.', 'learn', array['upper'], false),
  ('What are the three states of matter? Give one example of each that you can find at home.', 'learn', array['upper'], false),
  ('Name three African countries and their capital cities, and tell us one fact about each.', 'learn', array['upper'], false),
  ('Explain why we must wash our hands, as if you were teaching a younger child.', 'learn', array['lower','upper'], false),
  ('Draw the life cycle of a butterfly and show us.', 'learn', array['lower','upper'], true),
  ('Find three things at home that float and three that sink. Tell us what you found.', 'learn', array['lower','upper'], false),
  ('Take a picture of something round, something square and something shaped like a triangle around you.', 'learn', array['early','lower'], true),
  ('Name five animals that live on a farm and five that live in the forest.', 'learn', array['lower'], false),
  ('Write five words that rhyme with "cat" and use one in a sentence.', 'learn', array['lower'], false),
  ('Tell us the days of the week in order and which one is your favourite.', 'learn', array['early','lower'], false),
  ('Tell us three things you can see that are red, three that are green and three that are yellow.', 'learn', array['early'], false),
  -- creative
  ('Write a short poem (four lines is enough) about your best friend, the rain or our school.', 'creative', array['lower','upper'], false),
  ('Make up a very short story about a lion who is afraid of the dark.', 'creative', array['lower','upper'], false),
  ('Draw a new school flag or badge and describe the colours you chose.', 'creative', array['early','lower','upper'], true),
  ('Design the school uniform of the future. Draw it or describe it and tell us why it is special.', 'creative', array['lower','upper'], true),
  ('Build a paper plane, hat or boat and show it to us!', 'creative', array['early','lower','upper'], true),
  ('Draw your dream house and tell us about the best room in it.', 'creative', array['early','lower','upper'], true)
) as v(prompt, kind, bands, needs_photo)
where not exists (select 1 from public.spotlight_tasks t where lower(t.prompt) = lower(v.prompt));

-- ============================================================
-- 2. SUBJECT TEACHERS
-- ============================================================
alter table public.profiles add column if not exists teacher_kind text not null default 'main';
alter table public.profiles drop constraint if exists profiles_teacher_kind_check;
alter table public.profiles add constraint profiles_teacher_kind_check check (teacher_kind in ('main', 'sub'));

-- Which classes (and which subjects in them) a subject teacher covers.
create table if not exists public.teacher_classes (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_name text not null,
  subjects text[] not null default '{}',
  primary key (teacher_id, class_name)
);
alter table public.teacher_classes enable row level security;
grant select, insert, update, delete on public.teacher_classes to authenticated;

drop policy if exists "teachers read their own class list" on public.teacher_classes;
create policy "teachers read their own class list" on public.teacher_classes for select
  using (teacher_id = auth.uid());
drop policy if exists "admins manage teacher classes" on public.teacher_classes;
create policy "admins manage teacher classes" on public.teacher_classes for all
  using (coalesce(public.current_role(), '') = 'admin')
  with check (coalesce(public.current_role(), '') = 'admin');

-- Admin: make someone a class teacher or a subject teacher.
-- p_assignments: [{ "class": "Grade 3", "subjects": ["Mathematics", "English"] }, ...]
create or replace function public.admin_set_teacher_setup(p_teacher uuid, p_kind text, p_assignments jsonb default '[]'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role text; v_current text; v_first text; v_item jsonb; v_class text; v_subjects text[];
  v_classes text[] := '{}';
begin
  if coalesce(public.current_role(), '') <> 'admin' then raise exception 'Only an admin can do this'; end if;
  if p_kind not in ('main', 'sub') then raise exception 'Unknown teacher type'; end if;
  select role, assigned_class into v_role, v_current from public.profiles where id = p_teacher;
  if v_role is null then raise exception 'Teacher not found'; end if;
  if v_role not in ('teacher', 'teacher_pending') then raise exception 'This account is not a teacher'; end if;

  delete from public.teacher_classes where teacher_id = p_teacher;

  if p_kind = 'sub' then
    for v_item in select * from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
      v_class := nullif(btrim(v_item ->> 'class'), '');
      if v_class is null or v_class = any (v_classes) then continue; end if;
      select coalesce(array_agg(distinct btrim(s)) filter (where btrim(s) <> ''), '{}')
        into v_subjects
      from jsonb_array_elements_text(coalesce(v_item -> 'subjects', '[]'::jsonb)) s;
      insert into public.teacher_classes (teacher_id, class_name, subjects) values (p_teacher, v_class, v_subjects);
      v_classes := v_classes || v_class;
    end loop;
    if coalesce(array_length(v_classes, 1), 0) = 0 then
      raise exception 'Pick at least one class for a subject teacher';
    end if;
    v_first := v_classes[1];
    update public.profiles
       set teacher_kind = 'sub',
           assigned_class = case when v_current = any (v_classes) then v_current else v_first end
     where id = p_teacher;
  else
    update public.profiles set teacher_kind = 'main' where id = p_teacher;
  end if;
end;
$$;
revoke execute on function public.admin_set_teacher_setup(uuid, text, jsonb) from anon, public;
grant execute on function public.admin_set_teacher_setup(uuid, text, jsonb) to authenticated;

-- A subject teacher picks which of their classes they are working in. The
-- rest of the portal (pupils, chat, assignments, tests, marks) already
-- follows "your class", so this one switch moves all of it.
create or replace function public.set_my_active_class(p_class text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.current_role(), '') <> 'teacher' then raise exception 'Only a teacher can do this'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and teacher_kind = 'sub') then
    raise exception 'Your class is set by the office';
  end if;
  if not exists (select 1 from public.teacher_classes where teacher_id = auth.uid() and class_name = p_class) then
    raise exception 'You are not set up to teach that class';
  end if;
  update public.profiles set assigned_class = p_class where id = auth.uid();
end;
$$;
revoke execute on function public.set_my_active_class(text) from anon, public;
grant execute on function public.set_my_active_class(text) to authenticated;

-- A subject teacher can only change marks for the subjects they teach in
-- the pupil's class (enforced here, not just hidden on the screen).
create or replace function public.guard_sub_teacher_results()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text; v_sid uuid; v_subject text; v_grade text; v_ok boolean;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  select teacher_kind into v_kind from public.profiles where id = auth.uid() and role = 'teacher';
  if v_kind is distinct from 'sub' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then v_sid := old.student_id; v_subject := old.subject;
  else v_sid := new.student_id; v_subject := new.subject; end if;
  select grade into v_grade from public.profiles where id = v_sid;

  select exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id = auth.uid() and tc.class_name = v_grade
      and exists (select 1 from unnest(tc.subjects) s where lower(btrim(s)) = lower(btrim(v_subject)))
  ) into v_ok;
  if not v_ok then
    raise exception 'You can only enter marks for the subjects you teach in this class';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists guard_sub_teacher_results_trg on public.results;
create trigger guard_sub_teacher_results_trg before insert or update or delete on public.results
  for each row execute function public.guard_sub_teacher_results();

-- Report-card remarks, ratings and signatures belong to the class teacher.
create or replace function public.guard_sub_teacher_report_cards()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_kind text;
begin
  if auth.uid() is not null then
    select teacher_kind into v_kind from public.profiles where id = auth.uid() and role = 'teacher';
    if v_kind = 'sub' then
      raise exception 'Only the class teacher can write report-card comments';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists guard_sub_teacher_report_cards_trg on public.report_cards;
create trigger guard_sub_teacher_report_cards_trg before insert or update or delete on public.report_cards
  for each row execute function public.guard_sub_teacher_report_cards();

notify pgrst, 'reload schema';
