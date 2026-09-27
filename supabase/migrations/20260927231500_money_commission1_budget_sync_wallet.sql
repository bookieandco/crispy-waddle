-- MONEY-COMMISSION.1 durable budget, signer-lease, and provider-sync state.
-- Secrets remain outside these tables. Raw signer tokens, private keys, mnemonics,
-- Plaid access tokens, and broker credentials are forbidden here.

CREATE TABLE IF NOT EXISTS money_strategy_budgets (
  budget_id TEXT PRIMARY KEY,
  coffer_id TEXT NOT NULL REFERENCES money_coffers(coffer_id) ON DELETE CASCADE,
  strategy_id TEXT NOT NULL,
  lane TEXT NOT NULL,
  currency TEXT NOT NULL,
  allocated_minor BIGINT NOT NULL CHECK (allocated_minor >= 0),
  reserved_minor BIGINT NOT NULL DEFAULT 0 CHECK (reserved_minor >= 0),
  spent_minor BIGINT NOT NULL DEFAULT 0 CHECK (spent_minor >= 0),
  hard_cap_minor BIGINT NOT NULL CHECK (hard_cap_minor >= 0),
  state TEXT NOT NULL CHECK (state IN ('ACTIVE','HALTED','EXHAUSTED')),
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(coffer_id,strategy_id,lane)
);

CREATE TABLE IF NOT EXISTS money_signer_leases (
  lease_id TEXT PRIMARY KEY,
  wallet_connection_id TEXT NOT NULL REFERENCES money_wallet_connections(connection_id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  token_fingerprint TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE','LOCKED','EXPIRED','REVOKED')),
  per_transaction_cap_minor BIGINT NOT NULL CHECK (per_transaction_cap_minor >= 0),
  rolling_24h_cap_minor BIGINT NOT NULL CHECK (rolling_24h_cap_minor >= 0),
  max_transaction_count INTEGER NOT NULL CHECK (max_transaction_count >= 0),
  allowed_destination_addresses TEXT[] NOT NULL DEFAULT '{}',
  allowed_assets TEXT[] NOT NULL DEFAULT '{}',
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at > issued_at)
);

CREATE TABLE IF NOT EXISTS money_provider_sync_state (
  sync_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_item_id TEXT NOT NULL,
  cursor TEXT,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE','LOGIN_REQUIRED','SYNC_ERROR','DISABLED')),
  included_account_ids TEXT[] NOT NULL DEFAULT '{}',
  last_successful_sync_at TIMESTAMPTZ,
  last_error_code TEXT,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,provider,provider_item_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_strategy_budgets',
    'money_signer_leases',
    'money_provider_sync_state'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM service_role',t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I','money_commission1_service_role_'||t,t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)','money_commission1_service_role_'||t,t);
  END LOOP;
END $$;

GRANT SELECT,INSERT,UPDATE ON
  money_strategy_budgets,
  money_signer_leases,
  money_provider_sync_state
TO service_role;

COMMENT ON TABLE money_strategy_budgets IS 'Per-strategy Coffer sub-budgets with a hard no-overdraft ceiling.';
COMMENT ON TABLE money_signer_leases IS 'Bounded signer session metadata only. Stores fingerprints, never raw tokens/private keys/mnemonics.';
COMMENT ON TABLE money_provider_sync_state IS 'Provider cursor/re-auth checkpoint state. Stores no provider access tokens.';
