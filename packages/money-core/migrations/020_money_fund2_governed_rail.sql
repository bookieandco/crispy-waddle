-- MONEY-FUND.2 governed funding rail substrate.
-- Stores admission, approval metadata, attempts, provider evidence and reconciliation.
-- No bank tokens, broker credentials, wallet keys, seed phrases or raw signer tokens.

CREATE TABLE IF NOT EXISTS money_funding_rail_admissions (
  rail_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('SANDBOX','LIVE')),
  admission TEXT NOT NULL CHECK (admission IN ('UNCOMMISSIONED','READ_ONLY','CONTROLLED_CANARY','LIVE')),
  allowed_kinds TEXT[] NOT NULL DEFAULT '{}',
  allowed_currencies TEXT[] NOT NULL DEFAULT '{}',
  source_kinds TEXT[] NOT NULL DEFAULT '{}',
  destination_kinds TEXT[] NOT NULL DEFAULT '{}',
  max_movement_minor BIGINT NOT NULL DEFAULT 0 CHECK (max_movement_minor >= 0),
  max_daily_movement_minor BIGINT NOT NULL DEFAULT 0 CHECK (max_daily_movement_minor >= 0),
  credential_ref TEXT,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS money_movement_approval_receipts (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type = 'money.movement.execute'),
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','consumed','expired')),
  requested_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS money_movement_approval_receipts_user_status_idx
  ON money_movement_approval_receipts(user_id,status,requested_at DESC);

CREATE TABLE IF NOT EXISTS money_movement_attempts (
  attempt_id TEXT PRIMARY KEY,
  movement_id TEXT NOT NULL REFERENCES money_movement_proposals(movement_id),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  instruction_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('STARTED','ACKNOWLEDGED','PENDING','SETTLED','FAILED','UNKNOWN','RECOVERY_REQUIRED')),
  provider_reference TEXT,
  recovery_required BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS money_movement_attempts_user_time_idx
  ON money_movement_attempts(user_id,started_at DESC);

CREATE TABLE IF NOT EXISTS money_movement_provider_events (
  event_id TEXT PRIMARY KEY,
  provider_event_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  movement_id TEXT NOT NULL REFERENCES money_movement_proposals(movement_id),
  instruction_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ACKNOWLEDGED','PENDING','SETTLED','REJECTED','CANCELLED','UNKNOWN')),
  provider_reference TEXT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  fee_minor BIGINT NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  currency TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE(provider,provider_event_id)
);

CREATE TABLE IF NOT EXISTS money_movement_reconciliations (
  reconciliation_id TEXT PRIMARY KEY,
  movement_id TEXT NOT NULL REFERENCES money_movement_proposals(movement_id),
  passed BOOLEAN NOT NULL,
  source_decrease_minor BIGINT NOT NULL,
  destination_increase_minor BIGINT NOT NULL,
  fee_minor BIGINT NOT NULL CHECK (fee_minor >= 0),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  observed_at TIMESTAMPTZ NOT NULL
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_funding_rail_admissions',
    'money_movement_approval_receipts',
    'money_movement_attempts',
    'money_movement_provider_events',
    'money_movement_reconciliations'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM service_role',t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I','money_fund2_service_role_'||t,t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)','money_fund2_service_role_'||t,t);
  END LOOP;
END $$;

GRANT SELECT,INSERT,UPDATE ON
  money_funding_rail_admissions,
  money_movement_approval_receipts,
  money_movement_attempts,
  money_movement_provider_events,
  money_movement_reconciliations
TO service_role;

INSERT INTO money_funding_rail_admissions(
  rail_id,provider,environment,admission,allowed_kinds,allowed_currencies,source_kinds,destination_kinds,max_movement_minor,max_daily_movement_minor,evidence_ids
)
VALUES (
  'funding:open','unassigned-funding-provider','LIVE','UNCOMMISSIONED',
  ARRAY['DEPOSIT','WITHDRAWAL','TRANSFER'],ARRAY['USD'],ARRAY['BANK','BROKER_CASH','CRYPTO_WALLET'],ARRAY['BANK','BROKER_CASH','CRYPTO_WALLET'],
  0,0,ARRAY['money-fund2:provider-opening']
)
ON CONFLICT (rail_id) DO NOTHING;

COMMENT ON TABLE money_funding_rail_admissions IS 'Fail-closed external funding rail admission. credential_ref is an opaque secret-manager reference, never a raw credential.';
COMMENT ON TABLE money_movement_approval_receipts IS 'Action Core-compatible approval receipt metadata for a bound Money movement. No provider authority is granted by approval alone.';
COMMENT ON TABLE money_movement_attempts IS 'Single-submit Money movement execution attempts. UNKNOWN/recovery states block duplicate provider submission.';
COMMENT ON TABLE money_movement_provider_events IS 'Provider-returned movement evidence. Evidence cannot authorize a movement.';
COMMENT ON TABLE money_movement_reconciliations IS 'Post-settlement source/destination/fee tie-out evidence.';
