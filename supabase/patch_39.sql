-- ============================================================
-- Citadel Highflyers UMS -- patch 39
--
-- Phone / browser push notifications.
--
-- 1. push_subscriptions: one row per browser or phone a person turned
--    notifications on for. A person reads and writes only their own.
-- 2. direct_messages.reminded_at: stamped when the "you have an unread
--    message" reminder has been pushed, so each message is nagged once.
-- 3. A scheduled job calls the send-push Edge Function every 30 minutes.
--    It reminds anyone with a private message that has sat unread for
--    2 days (and, if that person has no phone set up, does nothing).
--
-- BEFORE this works you must also (once):
--   a) generate VAPID keys:  npx web-push generate-vapid-keys
--   b) put the PUBLIC key in the site's environment as
--      VITE_VAPID_PUBLIC_KEY (Vercel > Settings > Environment Variables)
--      and redeploy the site;
--   c) set Edge Function secrets VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
--      VAPID_SUBJECT (e.g. mailto:citadelofhighflyersintlacademy@gmail.com)
--      and deploy the function:  supabase functions deploy send-push
-- Run this file once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "users manage their own push subscriptions" on public.push_subscriptions;
create policy "users manage their own push subscriptions"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.direct_messages add column if not exists reminded_at timestamptz;

-- Token the scheduled job sends so only it can trigger reminders.
-- (ai_settings already exists from patch_33.)
insert into public.ai_settings (key, value)
values ('push_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'citadel-unread-message-reminders';
select cron.schedule('citadel-unread-message-reminders', '*/30 * * * *', $job$
  select net.http_post(
    url := 'https://ubplmihazfynsfrlkhuo.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'remind_unread', true,
      'token', (select value from public.ai_settings where key = 'push_token')
    ),
    timeout_milliseconds := 60000
  );
$job$);

notify pgrst, 'reload schema';
