-- PENDING: NOT APPLIED. Swlc was read-only on 2026-10-12 (transaction_read_only=on).
-- Owner/server-only append ledger; apply via vetted Supabase migration once writes restored.
CREATE TABLE IF NOT EXISTS public.jhadina_sports_study_events (
  record_id text PRIMARY KEY,
  case_id text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('PREGAME_FORECAST','PREGAME_OBSERVATION','LIVE_OBSERVATION','POSTGAME_RESULT','POSTGAME_EVALUATION')),
  information_cutoff timestamptz NOT NULL,
  scheduled_kickoff timestamptz NOT NULL,
  source_class text NOT NULL CHECK (source_class IN ('ORIGINAL_CHAT','SOURCE_CAPTURED_AS_OF','LIVE_PROVISIONAL','OFFICIAL_FINAL','REVIEWED_EVALUATION')),
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(evidence_urls)='array'),
  payload_json jsonb NOT NULL CHECK(jsonb_typeof(payload_json)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_type NOT IN ('PREGAME_FORECAST','PREGAME_OBSERVATION') OR information_cutoff < scheduled_kickoff),
  CHECK (event_type <> 'LIVE_OBSERVATION' OR (information_cutoff >= scheduled_kickoff AND source_class = 'LIVE_PROVISIONAL')),
  CHECK (event_type <> 'PREGAME_FORECAST' OR source_class='ORIGINAL_CHAT'),
  CHECK (event_type NOT IN ('POSTGAME_RESULT','POSTGAME_EVALUATION') OR information_cutoff >= scheduled_kickoff)
);
CREATE INDEX IF NOT EXISTS jhadina_sports_study_case_timeline_idx ON public.jhadina_sports_study_events(case_id, created_at, record_id);
ALTER TABLE public.jhadina_sports_study_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jhadina_sports_study_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.jhadina_sports_study_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.jhadina_sports_study_events TO service_role;
COMMENT ON TABLE public.jhadina_sports_study_events IS 'Append-only research-only NFL study events; no betting authority.';
-- Application must compare record_id + payload on conflict and quarantine discrepancies.
-- A future migration must not change existing sports_shadow_decisions/records or their semantics.
