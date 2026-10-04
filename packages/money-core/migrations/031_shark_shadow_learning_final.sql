-- SHADOW.1-.9 / SHADOW-LEARNING.FINAL
-- Durable SHARK shadow-learning ledger. This schema is observation/learning only.
-- It grants no signing, broadcasting, execution, mandate, or live-capital authority.

CREATE TABLE IF NOT EXISTS public.money_shark_shadow_decisions (
  decision_id TEXT PRIMARY KEY,
  runtime_run_id TEXT NOT NULL UNIQUE REFERENCES public.money_shark_coffer_runtime_runs(run_id) ON DELETE CASCADE,
  envelope_id TEXT NOT NULL REFERENCES public.money_shark_runtime_ingress(envelope_id) ON DELETE CASCADE,
  charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES public.money_coffers(coffer_id) ON DELETE CASCADE,
  opportunity_id TEXT,
  chain_id TEXT NOT NULL,
  token_address TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('PAPER_TRADE','NO_TRADE')),
  side TEXT CHECK (side IS NULL OR side IN ('BUY','SELL')),
  runtime_disposition TEXT NOT NULL CHECK (runtime_disposition IN ('BLOCKED','RESEARCH_ONLY','PURSE_REJECTED','PURSE_NOT_ALLOCATED','ALLOCATED','PREFLIGHT_BLOCKED','AUTONOMOUS_INTENT_READY')),
  confidence_bps INTEGER NOT NULL CHECK (confidence_bps BETWEEN 0 AND 10000),
  source_risk_bps INTEGER NOT NULL CHECK (source_risk_bps BETWEEN 0 AND 10000),
  market_regime TEXT NOT NULL,
  decision_json JSONB NOT NULL,
  information_cutoff TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'SHADOW_DECISION_ONLY' CHECK (authority='SHADOW_DECISION_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (action='PAPER_TRADE' AND side IS NOT NULL)
    OR
    (action='NO_TRADE' AND side IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.money_shark_shadow_executions (
  simulation_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL UNIQUE REFERENCES public.money_shark_shadow_decisions(decision_id) ON DELETE CASCADE,
  requested_notional_minor BIGINT NOT NULL CHECK (requested_notional_minor >= 0),
  estimated_filled_minor BIGINT NOT NULL CHECK (estimated_filled_minor >= 0),
  fill_ratio_bps INTEGER NOT NULL CHECK (fill_ratio_bps BETWEEN 0 AND 10000),
  total_estimated_cost_bps INTEGER NOT NULL CHECK (total_estimated_cost_bps BETWEEN 0 AND 5000),
  execution_json JSONB NOT NULL,
  simulated_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'SHADOW_EXECUTION_SIMULATION_ONLY' CHECK (authority='SHADOW_EXECUTION_SIMULATION_ONLY'),
  can_sign BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_sign=FALSE),
  can_broadcast BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_broadcast=FALSE),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (estimated_filled_minor <= requested_notional_minor)
);

CREATE TABLE IF NOT EXISTS public.money_shark_shadow_positions (
  position_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL UNIQUE REFERENCES public.money_shark_shadow_decisions(decision_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('SIMULATED_OPEN','NO_POSITION')),
  notional_minor BIGINT NOT NULL CHECK (notional_minor >= 0),
  position_json JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'SHADOW_POSITION_ONLY' CHECK (authority='SHADOW_POSITION_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.money_shark_shadow_observations (
  observation_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL REFERENCES public.money_shark_shadow_decisions(decision_id) ON DELETE CASCADE,
  horizon TEXT NOT NULL CHECK (horizon IN ('15M','1H','4H','24H','3D','7D')),
  observation_json JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'SHADOW_OUTCOME_ONLY' CHECK (authority='SHADOW_OUTCOME_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(decision_id,horizon)
);

CREATE TABLE IF NOT EXISTS public.money_shark_shadow_lessons (
  lesson_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL REFERENCES public.money_shark_shadow_decisions(decision_id) ON DELETE CASCADE,
  horizon TEXT NOT NULL CHECK (horizon IN ('15M','1H','4H','24H','3D','7D')),
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  decision_quality_bps INTEGER NOT NULL,
  execution_cost_bps INTEGER NOT NULL CHECK (execution_cost_bps >= 0),
  confidence_error_bps INTEGER NOT NULL CHECK (confidence_error_bps BETWEEN 0 AND 10000),
  lesson_json JSONB NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'LEARNING_ONLY' CHECK (authority='LEARNING_ONLY'),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(decision_id,horizon)
);

CREATE TABLE IF NOT EXISTS public.money_shark_shadow_calibrations (
  calibration_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
  calibration_json JSONB NOT NULL,
  calibrated_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'LEARNING_ONLY' CHECK (authority='LEARNING_ONLY'),
  can_mutate_mandate BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_mutate_mandate=FALSE),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.money_shark_shadow_memory (
  memory_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  market_regime TEXT NOT NULL,
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
  memory_json JSONB NOT NULL,
  created_at_evidence TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'LEARNING_MEMORY_ONLY' CHECK (authority='LEARNING_MEMORY_ONLY'),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.money_shark_shadow_replays (
  replay_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  replay_from TIMESTAMPTZ NOT NULL,
  replay_to TIMESTAMPTZ NOT NULL,
  decision_count INTEGER NOT NULL CHECK (decision_count >= 0),
  observation_count INTEGER NOT NULL CHECK (observation_count >= 0),
  lesson_count INTEGER NOT NULL CHECK (lesson_count >= 0),
  future_evidence_rejected INTEGER NOT NULL DEFAULT 0 CHECK (future_evidence_rejected >= 0),
  manifest_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'RESEARCH_REPLAY_ONLY' CHECK (authority='RESEARCH_REPLAY_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (replay_to >= replay_from)
);

CREATE INDEX IF NOT EXISTS money_shark_shadow_decisions_user_time_idx
  ON public.money_shark_shadow_decisions(user_id,decided_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_shadow_decisions_strategy_time_idx
  ON public.money_shark_shadow_decisions(user_id,strategy_id,decided_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_shadow_observations_due_idx
  ON public.money_shark_shadow_observations(decision_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_shadow_lessons_strategy_time_idx
  ON public.money_shark_shadow_lessons(user_id,strategy_id,evaluated_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_shadow_calibrations_strategy_time_idx
  ON public.money_shark_shadow_calibrations(user_id,strategy_id,calibrated_at DESC);
CREATE INDEX IF NOT EXISTS money_shark_shadow_memory_pattern_idx
  ON public.money_shark_shadow_memory(user_id,strategy_id,market_regime,created_at_evidence DESC);
CREATE INDEX IF NOT EXISTS money_shark_shadow_replays_user_time_idx
  ON public.money_shark_shadow_replays(user_id,generated_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_shark_shadow_decisions',
    'money_shark_shadow_executions',
    'money_shark_shadow_positions',
    'money_shark_shadow_observations',
    'money_shark_shadow_lessons',
    'money_shark_shadow_calibrations',
    'money_shark_shadow_memory',
    'money_shark_shadow_replays'
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

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_shark_shadow_decisions',
    'money_shark_shadow_executions',
    'money_shark_shadow_positions',
    'money_shark_shadow_observations',
    'money_shark_shadow_lessons',
    'money_shark_shadow_calibrations',
    'money_shark_shadow_memory',
    'money_shark_shadow_replays'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',t||'_service_role_only',t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t||'_service_role_only',t
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.money_shark_shadow_decisions IS 'Immutable SHARK/Money/Purse shadow decision twins, including NO_TRADE outcomes. Never execution authority.';
COMMENT ON TABLE public.money_shark_shadow_executions IS 'Read-only execution realism estimates. Database constraints forbid signing, broadcasting, and execution.';
COMMENT ON TABLE public.money_shark_shadow_positions IS 'Hypothetical position state derived from shadow simulations only.';
COMMENT ON TABLE public.money_shark_shadow_observations IS 'Point-in-time outcome observations for deterministic shadow horizons.';
COMMENT ON TABLE public.money_shark_shadow_lessons IS 'Counterfactual shadow lessons including avoided losses and missed gains. Learning only.';
COMMENT ON TABLE public.money_shark_shadow_calibrations IS 'Performance MIMS/calibration output. Cannot mutate mandate or authorize live trading.';
COMMENT ON TABLE public.money_shark_shadow_memory IS 'Pattern memory retrieved by later Money/Purse decisions. Learning context only.';
COMMENT ON TABLE public.money_shark_shadow_replays IS 'Historical replay manifests with point-in-time evidence fencing. Research only.';
