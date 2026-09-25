-- ============================================================
-- Citadel Highflyers UMS -- patch 36
--
-- Citadel AI security review (2026-09-25).
--
-- The admin-only storage-stats functions already return nothing to
-- non-admins; this also stops signed-out visitors calling them at all.
--
-- Data clean-up done alongside (run once, not repeatable here):
--   * the built-in FAQ that gave out the default password now refuses
--   * a built-in "admin login" FAQ that refuses was added
--   * the two saved voice clips that spoke the password were deleted
--     (via the citadel-ai function's forget_voice action)
--   * ai_answer_cache was emptied
-- ============================================================

revoke execute on function public.ai_storage_stats() from anon, public;
revoke execute on function public.ai_voice_stats() from anon, public;
grant execute on function public.ai_storage_stats() to authenticated;
grant execute on function public.ai_voice_stats() to authenticated;
