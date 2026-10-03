-- SHARK-COFFER.RUNTIME.1-.10 durable Money research and orchestration ledger.
-- All rows are evidence/intelligence only. No table grants financial execution authority.

CREATE TABLE IF NOT EXISTS public.money_shark_runtime_ingress (
  envelope_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  token_address TEXT NOT NULL,
  information_cutoff TIMESTAMPTZ NOT NULL,
  envelope_json JSONB NOT NULL,
  market_evidence_json JSONB NOT NULL,
  ingress_context_json JSONB NOT NULL,
  runtime_policy_json JSONB NOT NULL,
  calibration_sample_size INTEGER NOT NULL CHECK (calibration_sample_size >= 0),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'RESEARCH_INGRESS_ONLY' CHECK (authority='RESEARCH_INGRESS_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE)
);

CREATE TABLE IF NOT EXISTS public.money_fusion_evidence_events (
  evidence_id TEXT PRIMARY KEY,
  envelope_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(envelope_id) ON DELETE CASCADE,
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
  envelope_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(envelope_id) ON DELETE CASCADE,
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
  envelope_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(envelope_id) ON DELETE CASCADE,
  thesis_id TEXT NOT NULL REFERENCES public.money_financial_theses_v2(thesis_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('SUPPORTED','CONTESTED','WEAK','INVALIDATED')),
  assessment_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  authority TEXT NOT NULL DEFAULT 'ANALYSIS_ONLY' CHECK (authority='ANALYSIS_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE)
);

CREATE TABLE IF NOT EXISTS public.money_opportunities_v2 (
  opportunity_id TEXT PRIMARY KEY,
  envelope_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(envelope_id) ON DELETE CASCADE,
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
  envelope_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(envelope_id) ON DELETE CASCADE,
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
  envelope_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(envelope_id) ON DELETE CASCADE,
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
  envelope_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(envelope_id) ON DELETE CASCADE,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  disposition TEXT NOT NULL CHECK (disposition IN ('BLOCKED','RESEARCH_ONLY','PURSE_REJECTED','PURSE_ADMITTED','ALLOCATED','AUTONOMOUS_INTENT_READY')),
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
  ON public.money_shark_runtime_ingress(created_at ASC);
CREATE INDEX IF NOT EXISTS money_shark_runtime_ingress_user_time_idx
  ON public.money_shark_runtime_ingress(user_id,created_at ASC);
CREATE INDEX IF NOT EXISTS money_fusion_evidence_envelope_idx
  ON public.money_fusion_evidence_events(envelope_id,available_at ASC);
CREATE INDEX IF NOT EXISTS money_theses_envelope_idx
  ON public.money_financial_theses_v2(envelope_id,information_cutoff ASC);
CREATE INDEX IF NOT EXISTS money_opportunities_envelope_idx
  ON public.money_opportunities_v2(envelope_id,information_cutoff ASC);
CREATE INDEX IF NOT EXISTS money_shark_execution_packages_lookup_idx
  ON public.money_shark_execution_packages(envelope_id,charter_id,opportunity_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_autonomous_intents_lookup_idx
  ON public.money_shark_autonomous_intents(envelope_id,charter_id,opportunity_id,created_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_execution_evidence_opportunity_idx
  ON public.money_shark_execution_evidence(opportunity_id,available_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_execution_packages_opportunity_idx
  ON public.money_shark_execution_packages(opportunity_id,available_at DESC);
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

COMMENT ON TABLE public.money_shark_runtime_ingress IS 'Owner-scoped immutable SHARK->Money transport envelope plus raw read-only market evidence for restart-safe Money evaluation.';
COMMENT ON TABLE public.money_fusion_evidence_events IS 'Durable point-in-time fusion evidence. Evidence has no financial authority.';
COMMENT ON TABLE public.money_financial_theses_v2 IS 'Durable Money FinancialThesis artifacts; intelligence only.';
COMMENT ON TABLE public.money_dialectical_assessments IS 'Durable support/opposition assessment for Money theses; analysis only.';
COMMENT ON TABLE public.money_opportunities_v2 IS 'Durable risk/liquidity-assessed Money opportunities with MIMS and Money validation evidence; non-executing.';
COMMENT ON TABLE public.money_shark_execution_packages IS 'Durable planner/preflight evidence supplied by governed Money execution planning; never execution authority.';
COMMENT ON TABLE public.money_shark_autonomous_intents IS 'Durable non-authorizing autonomous trade intents awaiting existing mandate/risk/Action Core/permit/canary execution governance.';
COMMENT ON TABLE public.money_shark_execution_evidence IS 'Read-only provider/account/route/market/shadow/mandate evidence required to assemble a governed execution package; never execution authority.';
COMMENT ON TABLE public.money_shark_execution_packages IS 'Durable canonical intent/execution-plan/preflight evidence assembled by the existing Money execution stack; package itself cannot execute.';
COMMENT ON TABLE public.money_shark_coffer_runtime_runs IS 'Idempotent SHARK->Coffer orchestration receipts through Purse/autonomous-intent handoff; never execution authority.';
