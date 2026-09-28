-- DEX runtime commissioning readiness evidence.
-- Stores verified canary funding observations only. No private keys, API keys,
-- signer authorization headers, RPC credentials, or raw signed transactions.

CREATE TABLE IF NOT EXISTS money_dex_canary_funding_evidence (
  funding_evidence_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_connection_id TEXT NOT NULL REFERENCES money_wallet_connections(connection_id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  amount_atomic NUMERIC(78,0) NOT NULL CHECK (amount_atomic > 0),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  rpc_observation_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE(wallet_connection_id,asset_id,rpc_observation_id)
);

REVOKE ALL ON TABLE money_dex_canary_funding_evidence FROM PUBLIC;
REVOKE ALL ON TABLE money_dex_canary_funding_evidence FROM anon;
REVOKE ALL ON TABLE money_dex_canary_funding_evidence FROM authenticated;
REVOKE ALL ON TABLE money_dex_canary_funding_evidence FROM service_role;
ALTER TABLE money_dex_canary_funding_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_dex_canary_funding_evidence FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dex_runtime_service_role_money_dex_canary_funding_evidence ON money_dex_canary_funding_evidence;
CREATE POLICY dex_runtime_service_role_money_dex_canary_funding_evidence
ON money_dex_canary_funding_evidence
FOR ALL TO service_role
USING (true)
WITH CHECK (true);
GRANT SELECT,INSERT,UPDATE ON money_dex_canary_funding_evidence TO service_role;

COMMENT ON TABLE money_dex_canary_funding_evidence IS 'Verified tiny-canary funding observations for an isolated DEX Coffer wallet. Secret material is forbidden.';
