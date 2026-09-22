CREATE TABLE IF NOT EXISTS money_production_commissioning_receipts (
  receipt_id TEXT PRIMARY KEY,
  lane TEXT NOT NULL CHECK (lane IN ('STOCK','FOREX','SHARK_MEME','SPORTS_BETTING')),
  kind TEXT NOT NULL CHECK (kind IN ('SOFTWARE_CERTIFICATION','MARKET_DATA','PROVIDER_CONFIGURATION','CREDENTIAL_VERIFICATION','LIVE_CANARY','RECONCILIATION','KILL_SWITCH','SHADOW_SOAK')),
  provider TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('PAPER','SHADOW','LIVE')),
  passed BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  issuer TEXT NOT NULL CHECK (issuer IN ('MONEY_CERTIFICATION','PROVIDER_RUNTIME','OPERATIONS')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS money_prod_commissioning_lane_kind
ON money_production_commissioning_receipts(lane, kind, recorded_at DESC);

REVOKE ALL ON money_production_commissioning_receipts FROM PUBLIC;
REVOKE ALL ON money_production_commissioning_receipts FROM anon;
REVOKE ALL ON money_production_commissioning_receipts FROM authenticated;
REVOKE ALL ON money_production_commissioning_receipts FROM service_role;
GRANT SELECT, INSERT ON money_production_commissioning_receipts TO service_role;

ALTER TABLE money_production_commissioning_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_production_commissioning_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS money_prod_commissioning_service_role_only ON money_production_commissioning_receipts;
CREATE POLICY money_prod_commissioning_service_role_only
ON money_production_commissioning_receipts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE money_production_commissioning_receipts IS
'Append-only evidence receipts for MONEY-PROD.FINAL. Contains no provider credentials, private keys, broker secrets, or execution authority.';

CREATE TABLE IF NOT EXISTS money_production_platform_receipts (
  receipt_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('DATABASE_SCHEMA','PRODUCTION_DEPLOYMENT')),
  environment TEXT NOT NULL CHECK (environment = 'LIVE'),
  passed BOOLEAN NOT NULL,
  revision TEXT,
  recorded_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  issuer TEXT NOT NULL CHECK (issuer IN ('MONEY_CERTIFICATION','OPERATIONS')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (kind <> 'PRODUCTION_DEPLOYMENT' OR (revision IS NOT NULL AND length(btrim(revision)) > 0))
);

CREATE INDEX IF NOT EXISTS money_prod_platform_kind
ON money_production_platform_receipts(kind, recorded_at DESC);

REVOKE ALL ON money_production_platform_receipts FROM PUBLIC;
REVOKE ALL ON money_production_platform_receipts FROM anon;
REVOKE ALL ON money_production_platform_receipts FROM authenticated;
REVOKE ALL ON money_production_platform_receipts FROM service_role;
GRANT SELECT, INSERT ON money_production_platform_receipts TO service_role;

ALTER TABLE money_production_platform_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_production_platform_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS money_prod_platform_service_role_only ON money_production_platform_receipts;
CREATE POLICY money_prod_platform_service_role_only
ON money_production_platform_receipts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE money_production_platform_receipts IS
'Append-only platform evidence for MONEY-PROD.FINAL database schema and production deployment lineage. Stores no credentials.';
