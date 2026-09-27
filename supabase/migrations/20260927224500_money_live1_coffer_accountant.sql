-- MONEY-LIVE.1 durable Coffer/accountant substrate.
-- This migration stores policy, proposals, reconciliation evidence, wallet metadata,
-- and connector admissions. It deliberately stores no bank tokens, wallet private
-- keys, seed phrases, or provider execution credentials.

CREATE TABLE IF NOT EXISTS money_coffers (
  coffer_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  principal_capital_minor BIGINT NOT NULL CHECK (principal_capital_minor >= 0),
  hard_stop_floor_minor BIGINT NOT NULL CHECK (hard_stop_floor_minor >= 0),
  survival_floor_minor BIGINT NOT NULL CHECK (survival_floor_minor >= hard_stop_floor_minor),
  defensive_floor_minor BIGINT NOT NULL CHECK (defensive_floor_minor >= survival_floor_minor),
  state TEXT NOT NULL CHECK (state IN ('ACTIVE','DEFENSIVE','SURVIVAL','HALTED','RECAPITALIZATION_REQUIRED')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS money_profit_sweep_policies (
  coffer_id TEXT PRIMARY KEY REFERENCES money_coffers(coffer_id) ON DELETE CASCADE,
  threshold_minor BIGINT NOT NULL CHECK (threshold_minor > 0),
  retain_minor BIGINT NOT NULL DEFAULT 0 CHECK (retain_minor >= 0),
  planning_reserve_bps INTEGER NOT NULL DEFAULT 0 CHECK (planning_reserve_bps BETWEEN 0 AND 10000),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  verified_owner_destination_id TEXT,
  standing_mandate_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS money_funding_destinations (
  destination_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('BANK','BROKER_CASH','CRYPTO_WALLET')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS money_movement_proposals (
  movement_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  coffer_id TEXT NOT NULL REFERENCES money_coffers(coffer_id),
  kind TEXT NOT NULL CHECK (kind IN ('DEPOSIT','WITHDRAWAL','TRANSFER')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  source_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  authority_id TEXT NOT NULL,
  execution_permit_id TEXT NOT NULL,
  standing_mandate_id TEXT,
  provider TEXT,
  quote_json JSONB,
  instruction_json JSONB,
  state TEXT NOT NULL CHECK (state IN ('QUOTED','PENDING_APPROVAL','APPROVED','REJECTED','EXPIRED')),
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS money_profit_sweep_reconciliations (
  reconciliation_id TEXT PRIMARY KEY,
  movement_id TEXT NOT NULL REFERENCES money_movement_proposals(movement_id),
  journal_id TEXT NOT NULL,
  source_before_minor BIGINT NOT NULL,
  source_after_minor BIGINT NOT NULL,
  destination_before_minor BIGINT NOT NULL,
  destination_after_minor BIGINT NOT NULL,
  provider_fee_minor BIGINT NOT NULL CHECK (provider_fee_minor >= 0),
  passed BOOLEAN NOT NULL,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  observed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS money_wallet_connections (
  connection_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('OWNER_WALLET','COFFER_EXECUTION_WALLET')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','DISCONNECTED','REVOKED')),
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,provider,network,address)
);

CREATE TABLE IF NOT EXISTS money_market_connector_admissions (
  connector_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  lane TEXT NOT NULL CHECK (lane IN ('STOCK','FOREX','DEX')),
  admission TEXT NOT NULL CHECK (admission IN ('UNCOMMISSIONED','READ_ONLY','SHADOW','CONTROLLED_CANARY','LIVE')),
  credential_ref TEXT,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_coffers',
    'money_profit_sweep_policies',
    'money_funding_destinations',
    'money_movement_proposals',
    'money_profit_sweep_reconciliations',
    'money_wallet_connections',
    'money_market_connector_admissions'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM service_role',t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I','money_live1_service_role_'||t,t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)','money_live1_service_role_'||t,t);
  END LOOP;
END $$;

GRANT SELECT,INSERT,UPDATE ON
  money_coffers,
  money_profit_sweep_policies,
  money_funding_destinations,
  money_movement_proposals,
  money_profit_sweep_reconciliations,
  money_wallet_connections,
  money_market_connector_admissions
TO service_role;

COMMENT ON TABLE money_coffers IS 'Coffer capital and survival state. Automated strategies cannot source rescue capital outside this boundary.';
COMMENT ON TABLE money_profit_sweep_policies IS 'Owner-configured realized-profit threshold, retained capital, reserve and destination metadata.';
COMMENT ON TABLE money_movement_proposals IS 'Approval-gated deposit/withdrawal/transfer proposal ledger. No provider credentials are stored here.';
COMMENT ON TABLE money_profit_sweep_reconciliations IS 'Source/destination/fee tie-out evidence after an externally completed movement.';
COMMENT ON TABLE money_wallet_connections IS 'Wallet connection metadata only. Seed phrases and private keys are forbidden.';
COMMENT ON TABLE money_market_connector_admissions IS 'Fail-closed stock/forex/DEX connector admission registry.';


INSERT INTO money_market_connector_admissions(connector_id,provider,lane,admission,evidence_ids)
VALUES
 ('stock:open','unassigned-stock-broker','STOCK','UNCOMMISSIONED',ARRAY['money-live1:stock-opening']),
 ('forex:open','unassigned-fx-broker','FOREX','UNCOMMISSIONED',ARRAY['money-live1:forex-opening']),
 ('dex:open','unassigned-dex-router','DEX','UNCOMMISSIONED',ARRAY['money-live1:dex-opening'])
ON CONFLICT (connector_id) DO NOTHING;
