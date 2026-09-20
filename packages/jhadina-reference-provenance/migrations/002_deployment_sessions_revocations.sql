BEGIN;

CREATE TABLE IF NOT EXISTS reference_artifact_revocations (
  revocation_id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (
    target_type IN ('ADMISSION','ARTIFACT_PIN','ARTIFACT_DIGEST')
  ),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL,
  superseded_by TEXT,
  receipt_hash TEXT NOT NULL UNIQUE,
  receipt_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reference_artifact_revocations_target
  ON reference_artifact_revocations (target_type, target_id, revoked_at);

CREATE TABLE IF NOT EXISTS reference_deployment_sessions (
  session_id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL,
  subsystem TEXT NOT NULL,
  runtime_instance_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  pin_id TEXT NOT NULL,
  artifact_digest TEXT NOT NULL,
  admission_id TEXT NOT NULL REFERENCES reference_artifact_admissions(admission_id),
  state TEXT NOT NULL CHECK (state IN ('ACTIVE','STOPPED','INVALIDATED')),
  started_at TIMESTAMPTZ NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL,
  heartbeat_expires_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  invalidation_revocation_id TEXT REFERENCES reference_artifact_revocations(revocation_id),
  session_hash TEXT NOT NULL,
  session_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reference_deployment_sessions_runtime
  ON reference_deployment_sessions (runtime_instance_id, state);

CREATE TABLE IF NOT EXISTS reference_deployment_session_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES reference_deployment_sessions(session_id),
  kind TEXT NOT NULL CHECK (kind IN ('STARTED','HEARTBEAT','STOPPED','INVALIDATED')),
  occurred_at TIMESTAMPTZ NOT NULL,
  session_hash TEXT NOT NULL,
  event_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reference_deployment_session_events_session
  ON reference_deployment_session_events (session_id, occurred_at);

DROP TRIGGER IF EXISTS reference_artifact_revocations_append_only
  ON reference_artifact_revocations;
CREATE TRIGGER reference_artifact_revocations_append_only
BEFORE UPDATE OR DELETE ON reference_artifact_revocations
FOR EACH ROW EXECUTE FUNCTION prevent_reference_artifact_ledger_mutation();

DROP TRIGGER IF EXISTS reference_deployment_session_events_append_only
  ON reference_deployment_session_events;
CREATE TRIGGER reference_deployment_session_events_append_only
BEFORE UPDATE OR DELETE ON reference_deployment_session_events
FOR EACH ROW EXECUTE FUNCTION prevent_reference_artifact_ledger_mutation();

COMMIT;
