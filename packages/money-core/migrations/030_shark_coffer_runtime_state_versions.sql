-- SHARK-COFFER.RUNTIME restart/replay correction.
-- Runtime stage receipts and autonomous intents are state-versioned evidence.

ALTER TABLE public.money_shark_coffer_runtime_runs
  DROP CONSTRAINT IF EXISTS money_shark_coffer_runtime_runs_envelope_id_charter_id_disposition_key;

ALTER TABLE public.money_shark_autonomous_intents
  DROP CONSTRAINT IF EXISTS money_shark_autonomous_intents_envelope_id_charter_id_opportunity_id_key;

CREATE INDEX IF NOT EXISTS money_shark_runtime_runs_envelope_stage_idx
  ON public.money_shark_coffer_runtime_runs(envelope_id,charter_id,disposition,completed_at DESC);

CREATE INDEX IF NOT EXISTS money_shark_autonomous_intents_opportunity_idx
  ON public.money_shark_autonomous_intents(envelope_id,charter_id,opportunity_id,created_at DESC);

COMMENT ON TABLE public.money_shark_coffer_runtime_runs IS
  'State-versioned idempotent SHARK->Coffer orchestration receipts. Repeated stages are permitted when their evidence fingerprint changes.';

COMMENT ON TABLE public.money_shark_autonomous_intents IS
  'State-versioned non-authorizing autonomous intents. New mandate/preflight state creates a new intent instead of mutating prior evidence.';
