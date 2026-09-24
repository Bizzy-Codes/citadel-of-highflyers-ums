-- ============================================================
-- Citadel Highflyers UMS -- patch 33
--
-- Citadel AI learns its FAQs from real questions.
--
-- 1. ai_questions: every question typed or spoken to Citadel AI --
--    the words only, plus the asker's role and how it was answered.
--    No user id, no name. Kept 90 days, then deleted automatically.
-- 2. ai_faq: ready-made answers the browser uses instantly, without
--    asking Gemini. Seeded with built-in ones below; every 1st and 15th
--    of the month the citadel-ai function looks at the last two weeks
--    of questions that DID need Gemini, groups the most common ones, and
--    adds answers for them ("learned"). Admins can edit, switch off or
--    delete any of them from the portal (Admin > Citadel AI).
-- 3. Admins can also read and delete the question log and the shared
--    answer store (ai_answer_cache, patch_32) from that page.
-- ============================================================

-- ---- 1. question log ------------------------------------------------
create table if not exists public.ai_questions (
  id         bigint generated always as identity primary key,
  question   text not null check (char_length(question) <= 300),
  role       text not null default 'guest',
  handled    text not null,            -- 'instant' | 'faq' | 'cache' | 'gemini'
  created_at timestamptz not null default now()
);
create index if not exists ai_questions_created_idx on public.ai_questions (created_at desc);
alter table public.ai_questions enable row level security;

drop policy if exists "admins read ai questions" on public.ai_questions;
create policy "admins read ai questions" on public.ai_questions
  for select using (public.current_role() = 'admin');
drop policy if exists "admins delete ai questions" on public.ai_questions;
create policy "admins delete ai questions" on public.ai_questions
  for delete using (public.current_role() = 'admin');

-- The browser logs through this function rather than inserting
-- directly, so it can only ever add a short, well-formed row.
create or replace function public.log_ai_question(p_question text, p_role text, p_handled text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_q text := left(trim(regexp_replace(coalesce(p_question, ''), '\s+', ' ', 'g')), 300);
begin
  if v_q = '' or p_handled not in ('instant', 'faq', 'cache', 'gemini') then
    return;
  end if;
  insert into public.ai_questions (question, role, handled)
  values (
    v_q,
    case when p_role in ('guest', 'student', 'teacher', 'teacher_pending', 'admin') then p_role else 'guest' end,
    p_handled
  );
end;
$$;
grant execute on function public.log_ai_question(text, text, text) to anon, authenticated;

-- ---- 2. FAQ answers ---------------------------------------------------
create table if not exists public.ai_faq (
  id          bigint generated always as identity primary key,
  phrases     text[] not null,           -- ways people ask it, lower-case
  roles       text[] not null default array['guest','student','teacher','teacher_pending','admin'],
  answer      text not null,
  open_page   text,                      -- page key from src/components/ai/catalog.ts
  start_guide text,                      -- guide key from src/components/ai/guides.ts
  source      text not null default 'built-in',  -- 'built-in' | 'learned'
  asked       integer not null default 0,         -- how often it came up when learned
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.ai_faq enable row level security;

drop policy if exists "anyone reads enabled faq" on public.ai_faq;
create policy "anyone reads enabled faq" on public.ai_faq
  for select using (enabled or public.current_role() = 'admin');
drop policy if exists "admins manage faq" on public.ai_faq;
create policy "admins manage faq" on public.ai_faq
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- ---- 3. admins can see and clear the shared answer store --------------
drop policy if exists "admins read ai answer cache" on public.ai_answer_cache;
create policy "admins read ai answer cache" on public.ai_answer_cache
  for select using (public.current_role() = 'admin');
drop policy if exists "admins delete ai answer cache" on public.ai_answer_cache;
create policy "admins delete ai answer cache" on public.ai_answer_cache
  for delete using (public.current_role() = 'admin');

-- Space used, for the admin page.
create or replace function public.ai_storage_stats()
returns table(questions bigint, faqs bigint, stored_answers bigint, bytes bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.ai_questions),
    (select count(*) from public.ai_faq),
    (select count(*) from public.ai_answer_cache),
    pg_total_relation_size('public.ai_questions') + pg_total_relation_size('public.ai_faq')
      + pg_total_relation_size('public.ai_answer_cache')
  where public.current_role() = 'admin';
$$;
grant execute on function public.ai_storage_stats() to authenticated;

-- ---- 4. private settings (only the service role can read) -------------
create table if not exists public.ai_settings (
  key   text primary key,
  value text not null
);
alter table public.ai_settings enable row level security;
-- A random token the scheduled job sends to the function, so nobody
-- else can trigger an FAQ refresh.
insert into public.ai_settings (key, value)
values ('refresh_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- ---- 5. scheduled jobs --------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every night: drop questions older than 90 days and stale stored answers.
select cron.unschedule(jobid) from cron.job where jobname = 'citadel-ai-cleanup';
select cron.schedule('citadel-ai-cleanup', '30 2 * * *', $job$
  delete from public.ai_questions where created_at < now() - interval '90 days';
  delete from public.ai_answer_cache where created_at < now() - interval '7 days';
$job$);

-- 1st and 15th of each month, 03:00 UTC: learn new FAQs.
select cron.unschedule(jobid) from cron.job where jobname = 'citadel-ai-learn-faq';
select cron.schedule('citadel-ai-learn-faq', '0 3 1,15 * *', $job$
  select net.http_post(
    url := 'https://ubplmihazfynsfrlkhuo.supabase.co/functions/v1/citadel-ai',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'refresh_faq', true,
      'token', (select value from public.ai_settings where key = 'refresh_token')
    ),
    timeout_milliseconds := 120000
  );
$job$);

-- ---- 6. built-in FAQs ---------------------------------------------------
-- Only facts already on the website. Edit them from the admin page.
insert into public.ai_faq (phrases, roles, answer, open_page, start_guide)
select * from (values
  (array['how do i see my child result','how can i check my child result','check my child result','view my child result','how do parents see results','how do i check result','i want to see my child result','show me my child result','how i go see my pikin result'],
   array['guest'],
   'Parents see results by logging in to the portal with the child''s name or login ID and password, then opening Academic Results. Let me show you how to log in.',
   null, 'log_in'),
  (array['how do i see my child result','check my child result','i want to see my child result','show me my child result','view result','check result','my result'],
   array['student'],
   'Here are the results and report cards.', 'results', null),
  (array['how do i open my child account','how do i access my child account','how do i view my child account','how do i log in as parent','parent login','how parents log in'],
   array['guest'],
   'Parents use the child''s own account: log in with the child''s name or login ID and the password. Let me show you.', null, 'log_in'),
  (array['what is the default password','what is the first password','i forgot the password school gave me','which password do i use','what password do i use to log in'],
   array['guest','student','teacher','teacher_pending','admin'],
   'Accounts made by the school start with the password citadel1234. Please change it on your profile page after you log in.', null, null),
  (array['how do i change my password','change password','i want to change my password'],
   array['student','teacher','admin'],
   'You can change your password on your profile page. I have opened it for you.', 'profile', null),
  (array['how do i pay school fees','how do i pay fees','school account number','what is the account number','which bank','where do i pay','how i go pay school fees'],
   array['guest','student','teacher','teacher_pending','admin'],
   'Pay into First Bank, account name Citadel of Highflyers Int''l Academy, account number 2032386769. Then send the receipt on WhatsApp to 0706 497 0003.', null, null),
  (array['how do i upload my payment receipt','upload receipt','i have paid','where do i send receipt','send payment receipt'],
   array['student'],
   'You can upload your payment receipt on the fees page. I have opened it for you.', 'portal_fees', null),
  (array['what documents do i need for admission','documents for admission','what do i need to apply','admission requirements','requirements for admission'],
   array['guest','student','teacher','teacher_pending','admin'],
   'For admission you fill the form online and can upload the birth certificate, immunisation record and the last school report. Then you pay the 2,000 naira processing fee.', 'admissions', null),
  (array['how much is admission form','how much is the application form','application fee','admission fee','how much to apply'],
   array['guest','student','teacher','teacher_pending','admin'],
   'The application processing fee is 2,000 naira. You can pay cash at the school office or by bank transfer.', null, null),
  (array['what classes do you have','which classes do you have','what classes are in the school','do you have nursery','do you have creche','do you have daycare'],
   array['guest','student','teacher','teacher_pending','admin'],
   'We have Daycare, Reception, Kindergarten 1 and 2, Pre-Grade, and Grade 1 to Grade 5.', null, null),
  (array['what curriculum do you use','which curriculum','british curriculum','nigerian curriculum'],
   array['guest','student','teacher','teacher_pending','admin'],
   'We use a British and Nigerian integrated curriculum, with STEM and digital skills for every grade, in small classes.', null, null),
  (array['who is the founder','who owns the school','who is the proprietor','who is the owner'],
   array['guest','student','teacher','teacher_pending','admin'],
   'The founder is Pastor Chrispraise Iwunna and the proprietor is Ambassador Iwunna Princess.', 'founders', null),
  (array['who is the head teacher','who is the headmistress','who is the head of school'],
   array['guest','student','teacher','teacher_pending','admin'],
   'Ruth Sankira is the Head Teacher and Head of Kindergarten. Lene Temi heads the Graders arm.', 'founders', null),
  (array['how much is uniform','uniform price','how much is school uniform','uniform cost'],
   array['guest','student','teacher','teacher_pending','admin'],
   'A complete suit is about 21,500 to 21,800 naira, sportswear 11,700, two T-shirts 12,600, and a cardigan 10,800 to 11,500, depending on the class.', 'fees', null),
  (array['can siblings use the same email','can i use one email for my children','same email for my kids','one email for two children'],
   array['guest','student','teacher','teacher_pending','admin'],
   'Yes. Brothers and sisters can all be registered with the same parent email.', null, null),
  (array['how do i check my child attendance','check attendance','see attendance','my attendance'],
   array['guest'],
   'Log in with your child''s account and open My Attendance. Let me show you how to log in.', null, 'log_in'),
  (array['how do i check my child attendance','check attendance','see attendance','my attendance'],
   array['student'],
   'Here is the attendance page.', 'attendance', null),
  (array['how do i contact my child teacher','message the teacher','talk to the teacher','send message to teacher'],
   array['student'],
   'You can write to the teacher on the Messages page. I have opened it for you.', 'messages', null),
  (array['how do i see the timetable','class timetable','show timetable','what subjects today'],
   array['student','teacher'],
   'Here is the class timetable.', 'timetable', null)
) as seed(phrases, roles, answer, open_page, start_guide)
where not exists (select 1 from public.ai_faq where source = 'built-in');
