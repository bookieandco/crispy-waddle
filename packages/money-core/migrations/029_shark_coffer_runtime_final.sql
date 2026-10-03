-- SHARK-COFFER.RUNTIME.1-.10 durable Money research and orchestration ledger.
-- All rows are evidence/intelligence only. No table grants financial execution authority.

CREATE TABLE IF NOT EXISTS public.money_shark_runtime_ingress (
  runtime_ingress_id TEXT PRIMARY KEY,
  envelope_id TEXT NOT NULL,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  assessment_id TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  token_address TEXT NOT NULL,
  information_cutoff TIMESTAMPTZ NOT NULL,
  envelope_json JSONB NOT NULL,
  market_evidence_json JSONB NOT NULL,
  policy_json JSONB NOT NULL,
  ingress_context_json JSONB NOT NULL,
  calibration_sample_size INTEGER NOT NULL CHECK (calibration_sample_size >= 0),
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','LEASED','COMPLETED')),
  lease_owner TEXT,
  lease_token TEXT,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  completed_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  authority TEXT NOT NULL DEFAULT 'RESEARCH_INGRESS_ONLY' CHECK (authority='RESEARCH_INGRESS_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  UNIQUE(envelope_id,charter_id),
  CHECK (
    (status='PENDING' AND lease_owner IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL)
    OR
    (status='LEASED' AND lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (status='COMPLETED' AND completed_run_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.money_fusion_evidence_events (
  evidence_id TEXT PRIMARY KEY,
  runtime_ingress_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(runtime_ingress_id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  available_at TIMESTAMPTZ NOT NULL,
  evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  authority TEXT NOT NULL DEFAULT 'FUSION_EVIDENCE_ONLY' CHECK (authority='FUSION_EVIDENCE_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE)
);

CREATE TABLE IF NOT EXISTS public.money_financial_theses_v2 (
  thesis_id TEXT PRIMARY KEY,
  runtime_ingress_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(runtime_ingress_id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  information_cutoff TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  thesis_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'INTELLIGENCE_ONLY' CHECK (authority='INTELLIGENCE_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE)
);

CREATE TABLE IF NOT EXISTS public.money_dialectical_assessments (
  assessment_id TEXT PRIMARY KEY,
  runtime_ingress_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(runtime_ingress_id) ON DELETE CASCADE,
  thesis_id TEXT NOT NULL REFERENCES public.money_financial_theses_v2(thesis_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('SUPPORTED','CONTESTED','WEAK','INVALIDATED')),
  assessment_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  authority TEXT NOT NULL DEFAULT 'ANALYSIS_ONLY' CHECK (authority='ANALYSIS_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE)
);

CREATE TABLE IF NOT EXISTS public.money_opportunities_v2 (
  opportunity_id TEXT PRIMARY KEY,
  runtime_ingress_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(runtime_ingress_id) ON DELETE CASCADE,
  thesis_id TEXT NOT NULL REFERENCES public.money_financial_theses_v2(thesis_id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  information_cutoff TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  opportunity_json JSONB NOT NULL,
  trade_mims_json JSONB,
  validation_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  authority TEXT NOT NULL DEFAULT 'OPPORTUNITY_EVIDENCE_ONLY' CHECK (authority='OPPORTUNITY_EVIDENCE_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE)
);

CREATE TABLE IF NOT EXISTS public.money_shark_execution_evidence (
  evidence_id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES public.money_opportunities_v2(opportunity_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  evidence_json JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  available_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'EXECUTION_EVIDENCE_ONLY' CHECK (authority='EXECUTION_EVIDENCE_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (available_at >= observed_at),
  CHECK (expires_at > available_at)
);

CREATE TABLE IF NOT EXISTS public.money_shark_execution_packages (
  package_id TEXT PRIMARY KEY,
  runtime_ingress_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(runtime_ingress_id) ON DELETE CASCADE,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  opportunity_id TEXT NOT NULL,
  rebalance_plan_id TEXT NOT NULL,
  purse_intent_id TEXT NOT NULL,
  canonical_intent_json JSONB NOT NULL,
  execution_plan_json JSONB NOT NULL,
  preflight_json JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'EXECUTION_PLANNING_EVIDENCE_ONLY' CHECK (authority='EXECUTION_PLANNING_EVIDENCE_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  UNIQUE(envelope_id,charter_id,opportunity_id,rebalance_plan_id)
);

CREATE TABLE IF NOT EXISTS public.money_shark_autonomous_intents (
  intent_id TEXT PRIMARY KEY,
  runtime_ingress_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(runtime_ingress_id) ON DELETE CASCADE,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  opportunity_id TEXT NOT NULL,
  mandate_id TEXT NOT NULL,
  intent_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'INTELLIGENCE_ONLY' CHECK (authority='INTELLIGENCE_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  UNIQUE(envelope_id,charter_id,opportunity_id)
);

CREATE TABLE IF NOT EXISTS public.money_shark_coffer_runtime_runs (
  run_id TEXT PRIMARY KEY,
  runtime_ingress_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(runtime_ingress_id) ON DELETE CASCADE,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  disposition TEXT NOT NULL CHECK (disposition IN ('BLOCKED','RESEARCH_ONLY','PURSE_REJECTED','PURSE_ADMITTED','PURSE_NOT_ALLOCATED','ALLOCATED','PREFLIGHT_BLOCKED','AUTONOMOUS_INTENT_READY')),
  opportunity_id TEXT,
  purse_bus_event_id TEXT,
  allocation_plan_id TEXT,
  decision_set_id TEXT,
  rebalance_plan_id TEXT,
  autonomous_intent_id TEXT,
  run_json JSONB NOT NULL,
  information_cutoff TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'RUNTIME_EVIDENCE_ONLY' CHECK (authority='RUNTIME_EVIDENCE_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  UNIQUE(envelope_id,charter_id,disposition)
);

CREATE INDEX IF NOT EXISTS money_shark_runtime_ingress_time_idx
  ON public.money_shark_runtime_ingress(status,lease_expires_at,created_at ASC);
CREATE INDEX IF NOT EXISTS money_shark_runtime_ingress_user_time_idx
  ON public.money_shark_runtime_ingress(user_id,created_at ASC);
CREATE INDEX IF NOT EXISTS money_fusion_evidence_envelope_idx
  ON public.money_fusion_evidence_events(runtime_ingress_id,available_at ASC);
CREATE INDEX IF NOT EXISTS money_theses_envelope_idx
  ON public.money_financial_theses_v2(runtime_ingress_id,information_cutoff ASC);
CREATE INDEX IF NOT EXISTS money_opportunities_envelope_idx
  ON public.money_opportunities_v2(runtime_ingress_id,information_cutoff ASC);
CREATE INDEX IF NOT EXISTS money_shark_execution_packages_lookup_idx
  ON public.money_shark_execution_packages(envelope_id,charter_id,opportunity_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_autonomous_intents_lookup_idx
  ON public.money_shark_autonomous_intents(envelope_id,charter_id,opportunity_id,created_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_execution_evidence_opportunity_idx
  ON public.money_shark_execution_evidence(opportunity_id,available_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_execution_evidence_charter_idx
  ON public.money_shark_execution_evidence(user_id,coffer_id,charter_id,available_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_runtime_runs_user_time_idx
  ON public.money_shark_coffer_runtime_runs(user_id,completed_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_shark_runtime_ingress',
    'money_fusion_evidence_events',
    'money_financial_theses_v2',
    'money_dialectical_assessments',
    'money_opportunities_v2',
    'money_shark_execution_evidence',
    'money_shark_execution_packages',
    'money_shark_autonomous_intents',
    'money_shark_coffer_runtime_runs'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM service_role',t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO service_role',t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.money_claim_next_shark_coffer_runtime(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS SETOF public.money_shark_runtime_ingress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id)='' THEN
    RAISE EXCEPTION 'money_shark_runtime_worker_required';
  END IF;
  IF p_lease_seconds < 1 OR p_lease_seconds > 900 THEN
    RAISE EXCEPTION 'money_shark_runtime_lease_seconds_invalid';
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT i.runtime_ingress_id
    FROM public.money_shark_runtime_ingress i
    WHERE i.status='PENDING'
       OR (i.status='LEASED' AND i.lease_expires_at <= v_now)
    ORDER BY i.created_at ASC,i.runtime_ingress_id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.money_shark_runtime_ingress i
  SET status='LEASED',
      lease_owner=p_worker_id,
      lease_token=encode(gen_random_bytes(16),'hex'),
      lease_expires_at=v_now+make_interval(secs=>p_lease_seconds),
      attempt_count=i.attempt_count+1,
      updated_at=v_now
  FROM candidate c
  WHERE i.runtime_ingress_id=c.runtime_ingress_id
  RETURNING i.*;
END;
$;

CREATE OR REPLACE FUNCTION public.money_complete_shark_coffer_runtime(
  p_runtime_ingress_id TEXT,
  p_worker_id TEXT,
  p_lease_token TEXT,
  p_run_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  UPDATE public.money_shark_runtime_ingress
  SET status='COMPLETED',
      completed_run_id=p_run_id,
      lease_owner=NULL,
      lease_token=NULL,
      lease_expires_at=NULL,
      updated_at=v_now
  WHERE runtime_ingress_id=p_runtime_ingress_id
    AND status='LEASED'
    AND lease_owner=p_worker_id
    AND lease_token=p_lease_token
    AND lease_expires_at>v_now;
  RETURN FOUND;
END;
$;

REVOKE ALL ON FUNCTION public.money_claim_next_shark_coffer_runtime(TEXT,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.money_complete_shark_coffer_runtime(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.money_claim_next_shark_coffer_runtime(TEXT,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.money_complete_shark_coffer_runtime(TEXT,TEXT,TEXT,TEXT) TO service_role;

COMMENT ON TABLE public.money_shark_runtime_ingress IS 'Owner-scoped immutable SHARK->Money transport envelope plus raw read-only market evidence for restart-safe Money evaluation.';
COMMENT ON TABLE public.money_fusion_evidence_events IS 'Durable point-in-time fusion evidence. Evidence has no financial authority.';
COMMENT ON TABLE public.money_financial_theses_v2 IS 'Durable Money FinancialThesis artifacts; intelligence only.';
COMMENT ON TABLE public.money_dialectical_assessments IS 'Durable support/opposition assessment for Money theses; analysis only.';
COMMENT ON TABLE public.money_opportunities_v2 IS 'Durable risk/liquidity-assessed Money opportunities with MIMS and Money validation evidence; non-executing.';
COMMENT ON TABLE public.money_shark_autonomous_intents IS 'Durable non-authorizing autonomous trade intents awaiting existing mandate/risk/Action Core/permit/canary execution governance.';
COMMENT ON TABLE public.money_shark_execution_evidence IS 'Read-only provider/account/route/market/shadow/mandate evidence required to assemble a governed execution package; never execution authority.';
COMMENT ON TABLE public.money_shark_execution_packages IS 'Durable canonical intent/execution-plan/preflight evidence assembled by the existing Money execution stack; package itself cannot execute.';
COMMENT ON TABLE public.money_shark_coffer_runtime_runs IS 'Idempotent SHARK->Coffer orchestration receipts through Purse/autonomous-intent handoff; never execution authority.';
