-- ============================================================
-- Citadel Highflyers UMS -- patch 32
--
-- A shared answer store for Citadel AI.
--
-- Gemini's free tier takes several seconds per answer. Most questions
-- from website visitors repeat ("where is the school", "when do you
-- resume"), so the citadel-ai function saves the first answer to each
-- general question here and hands it straight back to everyone who asks
-- the same thing afterwards.
--
-- Only questions from visitors who are NOT signed in, asked as the
-- first message of a chat, are stored -- so nothing personal (a pupil's
-- assignments, a name) ever lands in this table. Rows expire after 7
-- days and are keyed on the version of the school facts, so editing
-- knowledge.ts retires the old answers automatically.
--
-- Only the Edge Function (service role) reads or writes it: RLS is on
-- with no policies, so the browser can't touch it.
-- ============================================================

create table if not exists public.ai_answer_cache (
  key        text primary key,          -- hash of facts version + question
  question   text not null,             -- normalised, for the admin's curiosity
  content    jsonb not null,            -- Gemini's reply, replayed as-is
  hits       integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.ai_answer_cache enable row level security;

create index if not exists ai_answer_cache_created_idx on public.ai_answer_cache (created_at);
