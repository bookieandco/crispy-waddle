-- MONEY-FUND.3 external funding provider commissioning evidence.
-- Certification metadata only. No raw credentials or execution authority.

ALTER TABLE money_funding_rail_admissions
  ADD COLUMN IF NOT EXISTS commissioning_certificate_id TEXT;

ALTER TABLE money_funding_rail_admissions
  DROP CONSTRAINT IF EXISTS money_funding_admission_certificate_required;

ALTER TABLE money_funding_rail_admissions
  ADD CONSTRAINT money_funding_admission_certificate_required
  CHECK (
    admission IN ('UNCOMMISSIONED','READ_ONLY')
    OR commissioning_certificate_id IS NOT NULL
  );

CREATE TABLE IF NOT EXISTS money_funding_commissioning_receipts (
  receipt_id TEXT PRIMARY KEY,
  rail_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'PROVIDER_CONFIGURATION',
    'OWNER_ACCOUNT_VERIFICATION',
    'CREDENTIAL_VERIFICATION',
    'KYC_ELIGIBILITY',
    'CAPABILITY_PROBE',
    'WEBHOOK_OR_STATUS_EVIDENCE',
    'KILL_SWITCH_DRILL',
    'LIVE_CANARY',
    'SETTLEMENT_RECONCILIATION',
    'UNKNOWN_EXECUTION_DRILL',
    'DUPLICATE_SUBMISSION_DRILL',
    'CANCEL_DRILL'
  )),
  evidence_class TEXT NOT NULL CHECK (evidence_class IN ('REAL_LIVE','SYNTHETIC_TEST')),
  passed BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  allowed_kinds TEXT[] NOT NULL DEFAULT '{}',
  allowed_currencies TEXT[] NOT NULL DEFAULT '{}',
  source_kinds TEXT[] NOT NULL DEFAULT '{}',
  destination_kinds TEXT[] NOT NULL DEFAULT '{}',
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  issuer TEXT NOT NULL CHECK (issuer IN ('PROVIDER_RUNTIME','OPERATIONS','MONEY_CERTIFICATION'))
);

CREATE INDEX IF NOT EXISTS money_funding_commissioning_receipts_rail_time_idx
  ON money_funding_commissioning_receipts(rail_id,recorded_at DESC);

CREATE TABLE IF NOT EXISTS money_funding_commissioning_certificates (
  certificate_id TEXT PRIMARY KEY,
  rail_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  evidence_class TEXT NOT NULL CHECK (evidence_class IN ('REAL_LIVE','SYNTHETIC_TEST')),
  status TEXT NOT NULL CHECK (status IN ('REJECTED','SOFTWARE_ONLY','CONTROLLED_CANARY_CERTIFIED','LIVE_CERTIFIED')),
  controlled_canary_certified BOOLEAN NOT NULL,
  live_certified BOOLEAN NOT NULL,
  admitted_kinds TEXT[] NOT NULL DEFAULT '{}',
  admitted_currencies TEXT[] NOT NULL DEFAULT '{}',
  source_kinds TEXT[] NOT NULL DEFAULT '{}',
  destination_kinds TEXT[] NOT NULL DEFAULT '{}',
  max_movement_minor BIGINT NOT NULL CHECK (max_movement_minor >= 0),
  max_daily_movement_minor BIGINT NOT NULL CHECK (max_daily_movement_minor >= 0),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  receipt_ids TEXT[] NOT NULL DEFAULT '{}',
  canary_ids TEXT[] NOT NULL DEFAULT '{}',
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS money_funding_commissioning_certificates_rail_time_idx
  ON money_funding_commissioning_certificates(rail_id,recorded_at DESC);

ALTER TABLE money_funding_rail_admissions
  DROP CONSTRAINT IF EXISTS money_funding_admission_certificate_fk;

ALTER TABLE money_funding_rail_admissions
  ADD CONSTRAINT money_funding_admission_certificate_fk
  FOREIGN KEY (commissioning_certificate_id)
  REFERENCES money_funding_commissioning_certificates(certificate_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_funding_commissioning_receipts',
    'money_funding_commissioning_certificates'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM service_role',t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I','money_fund3_service_role_'||t,t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)','money_fund3_service_role_'||t,t);
  END LOOP;
END $$;

GRANT SELECT,INSERT ON
  money_funding_commissioning_receipts,
  money_funding_commissioning_certificates
TO service_role;

COMMENT ON TABLE money_funding_commissioning_receipts IS 'Evidence-only receipts for external funding rail commissioning. REAL_LIVE and SYNTHETIC_TEST are never interchangeable.';
COMMENT ON TABLE money_funding_commissioning_certificates IS 'Non-executing funding rail certification outputs. Operational admission remains a separate persisted policy change.';


-- Cover funding foreign keys for parent-row maintenance and advisor cleanliness.
CREATE INDEX IF NOT EXISTS money_movement_attempts_movement_fk_idx
  ON money_movement_attempts(movement_id);
CREATE INDEX IF NOT EXISTS money_movement_provider_events_movement_fk_idx
  ON money_movement_provider_events(movement_id);
CREATE INDEX IF NOT EXISTS money_movement_reconciliations_movement_fk_idx
  ON money_movement_reconciliations(movement_id);
CREATE INDEX IF NOT EXISTS money_funding_rail_admissions_commissioning_cert_idx
  ON money_funding_rail_admissions(commissioning_certificate_id)
  WHERE commissioning_certificate_id IS NOT NULL;
