-- Portable Memory gateway role and least-privilege runtime surface.
--
-- Hosted Supabase's service_role bypasses RLS. The portable gateway must not
-- inherit that broad authority, especially because the same database contains
-- Money/SHARK/Coffer state. Create a dedicated NOLOGIN capability role, grant
-- only the MemoryStorage operations it needs, and add explicit permissive RLS
-- policies only for that role.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'jhadina_memory_gateway'
  ) THEN
    CREATE ROLE jhadina_memory_gateway NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO jhadina_memory_gateway;

GRANT SELECT, INSERT, DELETE
  ON public.jhadina_memory_candidates
  TO jhadina_memory_gateway;

GRANT SELECT, INSERT, UPDATE
  ON public.jhadina_memories
  TO jhadina_memory_gateway;

GRANT SELECT, INSERT, UPDATE
  ON public.jhadina_reasoning_events
  TO jhadina_memory_gateway;

GRANT SELECT, INSERT
  ON public.jhadina_timeline_events
  TO jhadina_memory_gateway;

GRANT EXECUTE ON FUNCTION public.jhadina_retire_memory(text,text,text,timestamptz)
  TO jhadina_memory_gateway;
GRANT EXECUTE ON FUNCTION public.jhadina_correct_memory(text,text,text,text,numeric,text,timestamptz)
  TO jhadina_memory_gateway;

CREATE POLICY jhadina_memory_candidates_portable_gateway
  ON public.jhadina_memory_candidates
  AS PERMISSIVE FOR ALL
  TO jhadina_memory_gateway
  USING (true)
  WITH CHECK (true);

CREATE POLICY jhadina_memories_portable_gateway
  ON public.jhadina_memories
  AS PERMISSIVE FOR ALL
  TO jhadina_memory_gateway
  USING (true)
  WITH CHECK (true);

CREATE POLICY jhadina_reasoning_events_portable_gateway
  ON public.jhadina_reasoning_events
  AS PERMISSIVE FOR ALL
  TO jhadina_memory_gateway
  USING (true)
  WITH CHECK (true);

CREATE POLICY jhadina_timeline_events_portable_gateway
  ON public.jhadina_timeline_events
  AS PERMISSIVE FOR ALL
  TO jhadina_memory_gateway
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.jhadina_memory_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.jhadina_memories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.jhadina_reasoning_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.jhadina_timeline_events FROM PUBLIC, anon, authenticated;
