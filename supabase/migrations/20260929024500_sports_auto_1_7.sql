-- SPORT-AUTO.1-.7 durable sports learning and shadow substrate.
-- Server-side only. These tables contain model/evidence lineage, never betting credentials.

CREATE TABLE IF NOT EXISTS sports_historical_records (
  record_id TEXT PRIMARY KEY,
  sport TEXT NOT NULL,
  competition_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  event_id TEXT,
  subject_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  metric TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  available_at TIMESTAMPTZ NOT NULL,
  source_type TEXT NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (available_at >= observed_at)
);

CREATE INDEX IF NOT EXISTS sports_historical_lookup_idx
  ON sports_historical_records(sport, competition_id, subject_id, metric, available_at);
CREATE INDEX IF NOT EXISTS sports_historical_event_idx
  ON sports_historical_records(event_id, available_at)
  WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sports_learning_episodes (
  episode_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_version TEXT NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sports_learning_strategy_idx
  ON sports_learning_episodes(strategy_id, resolved_at);
CREATE INDEX IF NOT EXISTS sports_learning_event_idx
  ON sports_learning_episodes(event_id, resolved_at);

CREATE TABLE IF NOT EXISTS sports_shadow_decisions (
  decision_id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  decision_at TIMESTAMPTZ NOT NULL,
  source_class TEXT NOT NULL CHECK (source_class IN ('REAL_AS_OF','SYNTHETIC_TEST')),
  action TEXT NOT NULL CHECK (action IN ('SHADOW_WAGER','NO_BET')),
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sports_shadow_prediction_once_idx
  ON sports_shadow_decisions(prediction_id);
CREATE INDEX IF NOT EXISTS sports_shadow_event_idx
  ON sports_shadow_decisions(event_id, decision_at);

CREATE TABLE IF NOT EXISTS sports_shadow_records (
  record_id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sports_shadow_resolution_once_idx
  ON sports_shadow_records(prediction_id);
CREATE INDEX IF NOT EXISTS sports_shadow_record_event_idx
  ON sports_shadow_records(event_id, resolved_at);

ALTER TABLE sports_historical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_historical_records FORCE ROW LEVEL SECURITY;
ALTER TABLE sports_learning_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_learning_episodes FORCE ROW LEVEL SECURITY;
ALTER TABLE sports_shadow_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_shadow_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE sports_shadow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_shadow_records FORCE ROW LEVEL SECURITY;

REVOKE ALL ON sports_historical_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON sports_learning_episodes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON sports_shadow_decisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON sports_shadow_records FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON sports_historical_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON sports_learning_episodes TO service_role;
GRANT SELECT, INSERT ON sports_shadow_decisions TO service_role;
GRANT SELECT, INSERT ON sports_shadow_records TO service_role;
