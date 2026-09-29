-- DEX-PRODUCTION-CONVERGENCE.FINAL durable routing and authority lineage.

ALTER TABLE money_dex_execution_attempts
  DROP CONSTRAINT IF EXISTS money_dex_execution_attempts_provider_check;
ALTER TABLE money_dex_execution_attempts
  ADD CONSTRAINT money_dex_execution_attempts_provider_check
  CHECK (provider IN ('jupiter-ultra','raydium-direct','meteora-direct'));

ALTER TABLE money_dex_execution_attempts ADD COLUMN IF NOT EXISTS request_provider TEXT;
ALTER TABLE money_dex_execution_attempts ADD COLUMN IF NOT EXISTS pre_execution_binding_hash TEXT;
ALTER TABLE money_dex_execution_attempts ADD COLUMN IF NOT EXISTS approval_binding_hash TEXT;
ALTER TABLE money_dex_execution_attempts ADD COLUMN IF NOT EXISTS money_dex_gate_id TEXT;

UPDATE money_dex_execution_attempts SET request_provider=provider WHERE request_provider IS NULL;
UPDATE money_dex_execution_attempts
  SET pre_execution_binding_hash='legacy-preexec-unbound:'||attempt_id
  WHERE pre_execution_binding_hash IS NULL;
UPDATE money_dex_execution_attempts
  SET approval_binding_hash='legacy-money-approval-unbound:'||attempt_id
  WHERE approval_binding_hash IS NULL;
UPDATE money_dex_execution_attempts
  SET money_dex_gate_id='legacy-money-dex-gate-unbound:'||attempt_id
  WHERE money_dex_gate_id IS NULL;

ALTER TABLE money_dex_execution_attempts ALTER COLUMN request_provider SET NOT NULL;
ALTER TABLE money_dex_execution_attempts ALTER COLUMN pre_execution_binding_hash SET NOT NULL;
ALTER TABLE money_dex_execution_attempts ALTER COLUMN approval_binding_hash SET NOT NULL;
ALTER TABLE money_dex_execution_attempts ALTER COLUMN money_dex_gate_id SET NOT NULL;

ALTER TABLE money_dex_execution_attempts
  DROP CONSTRAINT IF EXISTS money_dex_execution_attempts_request_provider_check;
ALTER TABLE money_dex_execution_attempts
  ADD CONSTRAINT money_dex_execution_attempts_request_provider_check
  CHECK (request_provider IN ('jupiter-ultra','raydium-direct','meteora-direct','solana-dex-router'));

CREATE INDEX IF NOT EXISTS money_dex_execution_attempts_route_idx
  ON money_dex_execution_attempts(request_provider,provider,started_at DESC);

COMMENT ON COLUMN money_dex_execution_attempts.provider IS 'Actual DEX venue that produced/broadcast the transaction.';
COMMENT ON COLUMN money_dex_execution_attempts.request_provider IS 'Requested Money execution surface, including the universal router.';
COMMENT ON COLUMN money_dex_execution_attempts.pre_execution_binding_hash IS 'Verified SHARK assessment plus EDGE-001..007 binding hash.';
COMMENT ON COLUMN money_dex_execution_attempts.approval_binding_hash IS 'Independent Money risk approval plus immutable intent fingerprint binding.';
COMMENT ON COLUMN money_dex_execution_attempts.money_dex_gate_id IS 'Fresh quote/slippage/impact/fee-reserve/loss/admission veto receipt verified before signing.';
