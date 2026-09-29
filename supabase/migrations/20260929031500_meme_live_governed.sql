-- MEME-LIVE.GOVERNED durable provider-soak and eligibility evidence.
-- No key material, signer tokens, raw signed transactions, or unrestricted-live authority.

CREATE TABLE IF NOT EXISTS money_meme_provider_soak_evidence (
  soak_id TEXT PRIMARY KEY,
  evidence_class TEXT NOT NULL CHECK (evidence_class IN ('REAL_LIVE','SYNTHETIC_TEST')),
  provider TEXT NOT NULL CHECK (provider='solana-dex-router'),
  wallet_connection_id TEXT NOT NULL REFERENCES money_wallet_connections(connection_id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  completed_round_trips INTEGER NOT NULL CHECK (completed_round_trips >= 0),
  reconciled_broadcasts INTEGER NOT NULL CHECK (reconciled_broadcasts >= 0),
  unresolved_executions INTEGER NOT NULL CHECK (unresolved_executions >= 0),
  duplicate_broadcasts INTEGER NOT NULL CHECK (duplicate_broadcasts >= 0),
  unknown_executions INTEGER NOT NULL CHECK (unknown_executions >= 0),
  kill_switch_drill_passed BOOLEAN NOT NULL,
  restart_recovery_passed BOOLEAN NOT NULL,
  all_positions_flat BOOLEAN NOT NULL,
  execution_cost_reconciliation_passed BOOLEAN NOT NULL,
  max_observed_slippage_bps INTEGER NOT NULL CHECK (max_observed_slippage_bps BETWEEN 0 AND 10000),
  venue_coverage TEXT[] NOT NULL DEFAULT '{}',
  provider_receipt_ids TEXT[] NOT NULL DEFAULT '{}',
  onchain_signature_ids TEXT[] NOT NULL DEFAULT '{}',
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS money_meme_soak_wallet_time_idx
  ON money_meme_provider_soak_evidence(wallet_connection_id,ended_at DESC);

CREATE TABLE IF NOT EXISTS money_meme_governed_live_certifications (
  report_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  mandate_id TEXT REFERENCES money_autonomous_trading_mandates(mandate_id),
  wallet_connection_id TEXT NOT NULL REFERENCES money_wallet_connections(connection_id),
  strategy_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('BLOCKED','MEME_GOVERNED_LIVE_ELIGIBLE')),
  passed BOOLEAN NOT NULL,
  controlled_canary_certified BOOLEAN NOT NULL,
  router_commissioned BOOLEAN NOT NULL,
  coffer_commissioned BOOLEAN NOT NULL,
  provider_soak_passed BOOLEAN NOT NULL,
  owner_mandate_valid BOOLEAN NOT NULL,
  blocker_codes TEXT[] NOT NULL DEFAULT '{}',
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  unrestricted_live_authorized BOOLEAN NOT NULL DEFAULT FALSE CHECK (unrestricted_live_authorized=FALSE),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS money_meme_governed_strategy_time_idx
  ON money_meme_governed_live_certifications(strategy_id,recorded_at DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['money_meme_provider_soak_evidence','money_meme_governed_live_certifications']
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM service_role',t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE ON TABLE %I TO service_role',t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS money_meme_soak_service_role ON money_meme_provider_soak_evidence;
CREATE POLICY money_meme_soak_service_role ON money_meme_provider_soak_evidence
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS money_meme_governed_cert_service_role ON money_meme_governed_live_certifications;
CREATE POLICY money_meme_governed_cert_service_role ON money_meme_governed_live_certifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE money_meme_provider_soak_evidence IS
  'Real/synthetic provider-soak evidence for bounded meme live promotion; evidence only, never execution authority.';
COMMENT ON TABLE money_meme_governed_live_certifications IS
  'Eligibility receipts for MEME-LIVE.GOVERNED. unrestricted_live_authorized is database-enforced false.';
