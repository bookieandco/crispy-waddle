-- SPORT-AUTO.1-.7 runtime convergence: restart-safe automatic paper/shadow coordination.
-- Server-only state. No sportsbook credentials or live-money authority.

CREATE TABLE IF NOT EXISTS sports_auto_candidates (
  prediction_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL UNIQUE,
  opportunity_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('PREGAME','LIVE')),
  discovered_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN','RESOLVED')),
  resolved_at TIMESTAMPTZ,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((state='OPEN' AND resolved_at IS NULL) OR (state='RESOLVED' AND resolved_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS sports_auto_candidates_open_idx
  ON sports_auto_candidates(discovered_at, prediction_id)
  WHERE state='OPEN';
CREATE INDEX IF NOT EXISTS sports_auto_candidates_event_idx
  ON sports_auto_candidates(event_id, discovered_at);

CREATE TABLE IF NOT EXISTS sports_paper_decisions (
  decision_id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL UNIQUE REFERENCES sports_auto_candidates(prediction_id),
  event_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('PAPER_WAGER','NO_BET')),
  decided_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sports_paper_resolutions (
  settlement_id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL UNIQUE REFERENCES sports_auto_candidates(prediction_id),
  wager_id TEXT NOT NULL UNIQUE,
  resolved_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  settlement_json JSONB NOT NULL,
  review_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sports_paper_resolutions_resolved_idx
  ON sports_paper_resolutions(resolved_at, prediction_id);

ALTER TABLE sports_auto_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_auto_candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE sports_paper_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_paper_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE sports_paper_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_paper_resolutions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON sports_auto_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON sports_paper_decisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON sports_paper_resolutions FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON sports_auto_candidates TO service_role;
GRANT SELECT, INSERT ON sports_paper_decisions TO service_role;
GRANT SELECT, INSERT ON sports_paper_resolutions TO service_role;
