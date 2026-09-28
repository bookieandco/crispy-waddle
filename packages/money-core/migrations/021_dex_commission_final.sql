-- DEX-COMMISSION.FINAL durable controlled-canary execution evidence.
-- Stores signatures, hashes, provider IDs and reconciliation truth only.
-- Raw signed transactions, signer tokens, seed phrases and private keys are forbidden.

CREATE TABLE IF NOT EXISTS money_dex_execution_attempts (
  attempt_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL,
  run_lineage_id TEXT NOT NULL,
  leg TEXT NOT NULL CHECK (leg IN ('ENTRY','EXIT')),
  provider TEXT NOT NULL CHECK (provider = 'jupiter-ultra'),
  wallet_connection_id TEXT NOT NULL REFERENCES money_wallet_connections(connection_id),
  signer_lease_id TEXT NOT NULL REFERENCES money_signer_leases(lease_id),
  idempotency_key TEXT NOT NULL UNIQUE,
  input_mint TEXT NOT NULL,
  output_mint TEXT NOT NULL,
  input_amount_atomic NUMERIC(78,0) NOT NULL CHECK (input_amount_atomic > 0),
  minimum_output_atomic NUMERIC(78,0) NOT NULL CHECK (minimum_output_atomic > 0),
  signed_transaction_hash TEXT NOT NULL,
  primary_signature TEXT NOT NULL,
  provider_request_id TEXT NOT NULL,
  simulation_id TEXT,
  simulated_fee_lamports BIGINT,
  provider_receipt_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('SIGNED','SIMULATED','SUBMITTED','CONFIRMED','RECONCILED','FAILED','UNKNOWN')),
  error_code TEXT,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS money_dex_stage4_evidence (
  stage_id TEXT PRIMARY KEY,
  run_lineage_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  wallet_connection_id TEXT NOT NULL REFERENCES money_wallet_connections(connection_id),
  entry_execution_id TEXT NOT NULL,
  exit_execution_id TEXT NOT NULL,
  stage_evidence_hash TEXT NOT NULL UNIQUE,
  provider_receipt_ids TEXT[] NOT NULL,
  onchain_signature_ids TEXT[] NOT NULL,
  capital_bounded BOOLEAN NOT NULL,
  kill_switch_proven BOOLEAN NOT NULL,
  restart_recovery_proven BOOLEAN NOT NULL,
  sellability_proven BOOLEAN NOT NULL,
  position_flat_after_exit BOOLEAN NOT NULL,
  execution_cost_reconciled BOOLEAN NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  observed_at TIMESTAMPTZ NOT NULL,
  CHECK (entry_execution_id <> exit_execution_id)
);

CREATE TABLE IF NOT EXISTS money_dex_runtime_verifications (
  verification_id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES money_dex_stage4_evidence(stage_id),
  run_lineage_id TEXT NOT NULL,
  wallet_connection_id TEXT NOT NULL REFERENCES money_wallet_connections(connection_id),
  entry_execution_id TEXT NOT NULL,
  exit_execution_id TEXT NOT NULL,
  stage_evidence_hash TEXT NOT NULL,
  provider_receipt_ids TEXT[] NOT NULL,
  onchain_signature_ids TEXT[] NOT NULL,
  provider_evidence_verified BOOLEAN NOT NULL,
  onchain_evidence_verified BOOLEAN NOT NULL,
  source TEXT NOT NULL CHECK (source = 'COMMISSIONED_DEX_RUNTIME'),
  authority TEXT NOT NULL CHECK (authority = 'RUNTIME_EVIDENCE_ONLY'),
  verified_at TIMESTAMPTZ NOT NULL,
  CHECK (entry_execution_id <> exit_execution_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_dex_execution_attempts',
    'money_dex_stage4_evidence',
    'money_dex_runtime_verifications'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM service_role',t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I','dex_commission_final_service_role_'||t,t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)','dex_commission_final_service_role_'||t,t);
  END LOOP;
END $$;

GRANT SELECT,INSERT,UPDATE ON
  money_dex_execution_attempts,
  money_dex_stage4_evidence,
  money_dex_runtime_verifications
TO service_role;

COMMENT ON TABLE money_dex_execution_attempts IS 'Crash-safe DEX canary attempts. Persists deterministic signatures and hashes before broadcast; never raw signed transactions or signer secrets.';
COMMENT ON TABLE money_dex_stage4_evidence IS 'Controlled live canary round-trip evidence for one SHARK/Money lineage.';
COMMENT ON TABLE money_dex_runtime_verifications IS 'Commissioned-runtime attestation binding provider receipts and on-chain signatures to the Stage-4 evidence hash.';
