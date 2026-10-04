-- Portable Memory runtime privileges expected by the bounded gateway.
--
-- Supabase-managed projects provide service-role grants outside this repository
-- migration chain. Plain PostgreSQL does not. Reproduce only the privileges the
-- existing MemoryStorage protocol needs; browser roles remain unprivileged.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, DELETE
  ON public.jhadina_memory_candidates
  TO service_role;

GRANT SELECT, INSERT, UPDATE
  ON public.jhadina_memories
  TO service_role;

GRANT SELECT, INSERT, UPDATE
  ON public.jhadina_reasoning_events
  TO service_role;

GRANT SELECT, INSERT
  ON public.jhadina_timeline_events
  TO service_role;

GRANT EXECUTE ON FUNCTION public.jhadina_retire_memory(text,text,text,timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.jhadina_correct_memory(text,text,text,text,numeric,text,timestamptz)
  TO service_role;

REVOKE ALL ON public.jhadina_memory_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.jhadina_memories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.jhadina_reasoning_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.jhadina_timeline_events FROM PUBLIC, anon, authenticated;
