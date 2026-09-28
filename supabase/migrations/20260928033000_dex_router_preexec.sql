-- DEX-ROUTER.FINAL + SHARK-PREEXEC.FINAL durable execution lineage.
-- Expands venue persistence without weakening the existing controlled-canary boundary.

ALTER TABLE money_dex_execution_attempts
  DROP CONSTRAINT IF EXISTS money_dex_execution_attempts_provider_check;

ALTER TABLE money_dex_execution_attempts
  ADD CONSTRAINT money_dex_execution_attempts_provider_check
  CHECK (provider IN ('jupiter-ultra','raydium-direct','meteora-direct'));

ALTER TABLE money_dex_execution_attempts
  ADD COLUMN IF NOT EXISTS request_provider TEXT;

UPDATE money_dex_execution_attempts
SET request_provider = provider
WHERE request_provider IS NULL;

ALTER TABLE money_dex_execution_attempts
  ALTER COLUMN request_provider SET NOT NULL;

ALTER TABLE money_dex_execution_attempts
  DROP CONSTRAINT IF EXISTS money_dex_execution_attempts_request_provider_check;

ALTER TABLE money_dex_execution_attempts
  ADD CONSTRAINT money_dex_execution_attempts_request_provider_check
  CHECK (request_provider IN ('jupiter-ultra','raydium-direct','meteora-direct','solana-dex-router'));

ALTER TABLE money_dex_execution_attempts
  ADD COLUMN IF NOT EXISTS pre_execution_binding_hash TEXT;

ALTER TABLE money_dex_execution_attempts
  ADD COLUMN IF NOT EXISTS money_dex_gate_id TEXT;

-- Existing rows predate SHARK-PREEXEC.FINAL. Preserve them as explicit legacy lineage
-- rather than fabricating a new binding receipt for old executions.
UPDATE money_dex_execution_attempts
SET pre_execution_binding_hash = 'legacy-preexec-unbound:' || attempt_id
WHERE pre_execution_binding_hash IS NULL;

UPDATE money_dex_execution_attempts
SET money_dex_gate_id = 'legacy-money-dex-gate-unbound:' || attempt_id
WHERE money_dex_gate_id IS NULL;

ALTER TABLE money_dex_execution_attempts
  ALTER COLUMN pre_execution_binding_hash SET NOT NULL;

ALTER TABLE money_dex_execution_attempts
  ALTER COLUMN money_dex_gate_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS money_dex_execution_attempts_route_idx
  ON money_dex_execution_attempts(request_provider,provider,started_at DESC);

COMMENT ON COLUMN money_dex_execution_attempts.provider IS
  'Actual DEX venue used for the signed transaction.';
COMMENT ON COLUMN money_dex_execution_attempts.request_provider IS
  'Execution surface requested by Money; may be solana-dex-router while provider records the selected venue.';
COMMENT ON COLUMN money_dex_execution_attempts.pre_execution_binding_hash IS
  'Immutable SHARK assessment + EDGE-001..007 pre-execution binding hash verified before signing.';
COMMENT ON COLUMN money_dex_execution_attempts.money_dex_gate_id IS
  'Money DEX preflight gate receipt verified before signing.';
