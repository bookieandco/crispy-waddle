-- SHADOW-REPAIR.3: immutable legacy grade review markers.
-- The observation and lesson rows remain intact; unverified legacy spot
-- evidence must not influence newly calibrated decisions.
CREATE TABLE IF NOT EXISTS runpod_shark_shadow_grade_reviews (
  decision_id TEXT NOT NULL REFERENCES runpod_shark_shadow_decisions(decision_id),
  horizon TEXT NOT NULL CHECK (horizon IN ('15M','1H','4H','24H','3D','7D')),
  review_status TEXT NOT NULL CHECK (review_status IN ('UNVERIFIED','INVALID','VERIFIED')),
  reason_code TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (decision_id,horizon)
);

CREATE INDEX IF NOT EXISTS runpod_shadow_grade_reviews_status_idx
  ON runpod_shark_shadow_grade_reviews(review_status,reviewed_at);

COMMENT ON TABLE runpod_shark_shadow_grade_reviews IS
  'Non-destructive quarantine of legacy live spot-based outcomes; no auto-promotion to VERIFIED.';
