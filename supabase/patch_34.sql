-- ============================================================
-- Citadel Highflyers UMS -- patch 34
--
-- Stored voice recordings for Citadel AI.
--
-- Generating a natural voice clip takes Gemini 7-16 seconds on the
-- free tier -- too slow to wait for. So clips for answers that are the
-- same for everyone (the FAQ answers, fixed replies like the fees or
-- the address) are generated once and kept in this private bucket;
-- later visitors get the saved clip in well under a second. Answers
-- that mention anyone's own details are never stored.
--
-- Public-read bucket: it only ever holds answers that are the same for
-- everyone, and browsers fetch saved clips straight from the storage
-- CDN (reading them through the function took up to 6 s). Only the
-- citadel-ai function (service role) can write. ~100-500 KB per clip.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-voice', 'ai-voice', true, 3145728, array['audio/wav', 'audio/x-wav', 'audio/L16'])
on conflict (id) do nothing;
update storage.buckets set public = true where id = 'ai-voice';

-- Storage used by the saved clips, for the admin page.
create or replace function public.ai_voice_stats()
returns table(clips bigint, bytes bigint)
language sql stable security definer set search_path = public, storage as $$
  select count(*), coalesce(sum((metadata->>'size')::bigint), 0)
  from storage.objects
  where bucket_id = 'ai-voice' and public.current_role() = 'admin';
$$;
grant execute on function public.ai_voice_stats() to authenticated;

-- Every night, record the voice for any FAQ answer that doesn't have
-- one yet (new, learned or edited answers). A run records what it can
-- in ~100 s and the next night carries on.
select cron.unschedule(jobid) from cron.job where jobname = 'citadel-ai-record-voices';
select cron.schedule('citadel-ai-record-voices', '0 2 * * *', $job$
  select net.http_post(
    url := 'https://ubplmihazfynsfrlkhuo.supabase.co/functions/v1/citadel-ai',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'prerender_voice', true,
      'token', (select value from public.ai_settings where key = 'refresh_token')
    ),
    timeout_milliseconds := 150000
  );
$job$);
