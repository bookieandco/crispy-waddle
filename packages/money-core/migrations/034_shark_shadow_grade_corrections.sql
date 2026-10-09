-- SHADOW-REPAIR.3b: preserve originals; attach independently sourced correction evidence.
-- Do not delete, update, overwrite, or promote the historical spot-based grade.
-- An explicitly quarantined (INVALID/UNVERIFIED) original is required.
CREATE TABLE IF NOT EXISTS runpod_shark_shadow_grade_corrections (
  decision_id TEXT NOT NULL REFERENCES runpod_shark_shadow_decisions(decision_id),
  horizon TEXT NOT NULL CHECK (horizon IN ('15M','1H','4H','24H','3D','7D')),
  original_observation_id TEXT NOT NULL REFERENCES runpod_shark_shadow_observations(observation_id),
  corrected_observation_id TEXT NOT NULL UNIQUE,
  corrected_lesson_id TEXT NOT NULL UNIQUE,
  target_sample_id TEXT NOT NULL REFERENCES runpod_shadow_market_samples(sample_id),
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  observation_json JSONB NOT NULL,
  lesson_json JSONB NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (review_status IN ('PENDING_REVIEW','ACCEPTED','REJECTED')),
  review_receipt_id TEXT,
  authority TEXT NOT NULL DEFAULT 'PAPER_GRADE_CORRECTION_ONLY'
    CHECK (authority='PAPER_GRADE_CORRECTION_ONLY'),
  can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
  can_authorize_live BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_authorize_live=FALSE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(decision_id,horizon)
);
CREATE INDEX IF NOT EXISTS runpod_shadow_grade_correction_time_idx
  ON runpod_shark_shadow_grade_corrections(user_id,strategy_id,evaluated_at DESC);
COMMENT ON TABLE runpod_shark_shadow_grade_corrections IS
  'Immutable corrected paper observations and counterfactual lessons; originals survive unchanged.';
