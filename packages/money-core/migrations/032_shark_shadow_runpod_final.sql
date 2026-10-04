-- SHADOW-RUNPOD.FINAL
-- Standalone non-executing shadow-learning ledger for RunPod.
-- No foreign keys to SWLC are used so the runtime can operate during a Supabase outage.

CREATE TABLE IF NOT EXISTS runpod_shadow_market_samples (
  sample_id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  token_address TEXT NOT NULL,
  pair_address TEXT,
  dex_id TEXT,
  price_usd NUMERIC,
  liquidity_usd NUMERIC NOT NULL DEFAULT 0,
  volume_24h_usd NUMERIC NOT NULL DEFAULT 0,
  buys_24h INTEGER NOT NULL DEFAULT 0,
  sells_24h INTEGER NOT NULL DEFAULT 0,
  pair_created_at TIMESTAMPTZ,
  sample_json JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runpod_shark_shadow_decisions (
  decision_id TEXT PRIMARY KEY,
  runtime_run_id TEXT NOT NULL UNIQUE,
  envelope_id TEXT NOT NULL,
  charter_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL,
  opportunity_id TEXT,
  chain_id TEXT NOT NULL,
  token_address TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('PAPER_TRADE','NO_TRADE')),
  side TEXT CHECK (side IS NULL OR side IN ('BUY','SELL')),
  runtime_disposition TEXT NOT NULL,
  confidence_bps INTEGER NOT NULL CHECK (confidence_bps BETWEEN 0 AND 10000),
  source_risk_bps INTEGER NOT NULL CHECK (source_risk_bps BETWEEN 0 AND 10000),
  market_regime TEXT NOT NULL,
  baseline_sample_id TEXT NOT NULL REFERENCES runpod_shadow_market_samples(sample_id),
  baseline_price_usd NUMERIC,
  decision_json JSONB NOT NULL,
  information_cutoff TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  authority TEXT NOT NULL DEFAULT 'SHADOW_DECISION_ONLY' CHECK (authority='SHADOW_DECISION_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((action='PAPER_TRADE' AND side IS NOT NULL) OR (action='NO_TRADE' AND side IS NULL))
);

CREATE TABLE IF NOT EXISTS runpod_shark_shadow_executions (
  simulation_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL UNIQUE REFERENCES runpod_shark_shadow_decisions(decision_id) ON DELETE CASCADE,
  execution_json JSONB NOT NULL,
  simulated_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'SHADOW_EXECUTION_SIMULATION_ONLY' CHECK (authority='SHADOW_EXECUTION_SIMULATION_ONLY'),
  can_sign BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_sign=FALSE),
  can_broadcast BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_broadcast=FALSE),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runpod_shark_shadow_observations (
  observation_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL REFERENCES runpod_shark_shadow_decisions(decision_id) ON DELETE CASCADE,
  horizon TEXT NOT NULL CHECK (horizon IN ('15M','1H','4H','24H','3D','7D')),
  target_sample_id TEXT NOT NULL REFERENCES runpod_shadow_market_samples(sample_id),
  observation_json JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'SHADOW_OUTCOME_ONLY' CHECK (authority='SHADOW_OUTCOME_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(decision_id,horizon)
);

CREATE TABLE IF NOT EXISTS runpod_shark_shadow_lessons (
  lesson_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL REFERENCES runpod_shark_shadow_decisions(decision_id) ON DELETE CASCADE,
  horizon TEXT NOT NULL CHECK (horizon IN ('15M','1H','4H','24H','3D','7D')),
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  lesson_json JSONB NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'LEARNING_ONLY' CHECK (authority='LEARNING_ONLY'),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(decision_id,horizon)
);

CREATE TABLE IF NOT EXISTS runpod_shark_shadow_calibrations (
  calibration_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
  calibration_json JSONB NOT NULL,
  calibrated_at TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'LEARNING_ONLY' CHECK (authority='LEARNING_ONLY'),
  can_mutate_mandate BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_mutate_mandate=FALSE),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runpod_shark_shadow_memory (
  memory_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  market_regime TEXT NOT NULL,
  memory_json JSONB NOT NULL,
  created_at_evidence TIMESTAMPTZ NOT NULL,
  authority TEXT NOT NULL DEFAULT 'LEARNING_MEMORY_ONLY' CHECK (authority='LEARNING_MEMORY_ONLY'),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runpod_shark_shadow_sync_queue (
  sync_id BIGSERIAL PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN ('DECISION','EXECUTION','OBSERVATION','LESSON','CALIBRATION','MEMORY','REPLAY')),
  record_id TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','EXPORTED','ACKNOWLEDGED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exported_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  UNIQUE(record_type,record_id)
);

CREATE TABLE IF NOT EXISTS runpod_shark_shadow_runtime_state (
  state_key TEXT PRIMARY KEY,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS runpod_shadow_market_token_time_idx
  ON runpod_shadow_market_samples(chain_id,token_address,observed_at DESC);
CREATE INDEX IF NOT EXISTS runpod_shadow_decision_due_idx
  ON runpod_shark_shadow_decisions(decided_at DESC);
CREATE INDEX IF NOT EXISTS runpod_shadow_lessons_strategy_idx
  ON runpod_shark_shadow_lessons(user_id,strategy_id,evaluated_at DESC);
CREATE INDEX IF NOT EXISTS runpod_shadow_sync_pending_idx
  ON runpod_shark_shadow_sync_queue(status,created_at);

COMMENT ON TABLE runpod_shark_shadow_decisions IS 'RunPod standalone shadow decisions only; can_execute is permanently false.';
COMMENT ON TABLE runpod_shark_shadow_executions IS 'Simulated executions only; signing, broadcast, and execution are database-constrained false.';
COMMENT ON TABLE runpod_shark_shadow_sync_queue IS 'Export queue for later SWLC reconciliation. Import into live authority is never automatic.';
