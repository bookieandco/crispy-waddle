BEGIN;

CREATE TABLE IF NOT EXISTS reference_artifact_admissions (
  admission_id TEXT PRIMARY KEY,
  receipt_hash TEXT NOT NULL UNIQUE,
  artifact_id TEXT NOT NULL,
  pin_id TEXT NOT NULL,
  runtime_instance_scope JSONB NOT NULL,
  admitted_at TIMESTAMPTZ NOT NULL,
  receipt_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (receipt_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_reference_artifact_admissions_artifact
  ON reference_artifact_admissions (artifact_id, admitted_at DESC);

CREATE TABLE IF NOT EXISTS reference_artifact_attestations (
  attestation_id TEXT PRIMARY KEY,
  attestation_hash TEXT NOT NULL UNIQUE,
  admission_id TEXT NOT NULL
    REFERENCES reference_artifact_admissions(admission_id)
    ON DELETE RESTRICT,
  admission_receipt_hash TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  pin_id TEXT NOT NULL,
  runtime_instance_id TEXT NOT NULL,
  loaded_at TIMESTAMPTZ NOT NULL,
  attestation_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (attestation_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_reference_artifact_attestations_runtime
  ON reference_artifact_attestations (
    runtime_instance_id,
    artifact_id,
    loaded_at DESC
  );

CREATE OR REPLACE FUNCTION prevent_reference_artifact_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'reference artifact provenance ledger is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reference_artifact_admissions_append_only
  ON reference_artifact_admissions;
CREATE TRIGGER reference_artifact_admissions_append_only
BEFORE UPDATE OR DELETE ON reference_artifact_admissions
FOR EACH ROW EXECUTE FUNCTION prevent_reference_artifact_ledger_mutation();

DROP TRIGGER IF EXISTS reference_artifact_attestations_append_only
  ON reference_artifact_attestations;
CREATE TRIGGER reference_artifact_attestations_append_only
BEFORE UPDATE OR DELETE ON reference_artifact_attestations
FOR EACH ROW EXECUTE FUNCTION prevent_reference_artifact_ledger_mutation();

COMMIT;
