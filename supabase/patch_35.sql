-- ============================================================
-- Citadel Highflyers UMS -- patch 35
--
-- Queue of Citadel AI lines to record in the natural voice.
--
-- The app knows every fixed line it can say (page openings, guide
-- steps, built-in answers -- src/components/ai/voiceLines.ts). The admin
-- page's "Record voices now" puts them here; the citadel-ai function
-- records the ones not saved yet, most-used first, as far as the free
-- tier's daily allowance goes, and the nightly job carries on. Once a
-- line is recorded it plays instantly for everyone.
--
-- Only fixed, same-for-everyone lines go here -- never anything with a
-- person's details. Admin-only.
-- ============================================================

create table if not exists public.ai_voice_queue (
  text       text primary key check (char_length(text) <= 700),
  priority   integer not null default 5,
  created_at timestamptz not null default now()
);
alter table public.ai_voice_queue enable row level security;

drop policy if exists "admins manage voice queue" on public.ai_voice_queue;
create policy "admins manage voice queue" on public.ai_voice_queue
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
