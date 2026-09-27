-- MONEY-COMMISSION.2 + MONEY-FEED.1
-- Owner configuration and owner-scoped feed evidence.
-- No bank credentials, broker credentials, wallet keys, raw signer tokens, or seeds.

ALTER TABLE money_coffers
  ADD COLUMN IF NOT EXISTS max_deployable_bps INTEGER NOT NULL DEFAULT 5000
  CHECK (max_deployable_bps BETWEEN 0 AND 10000);

CREATE TABLE IF NOT EXISTS money_feed_events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'MARKET_WATCH',
    'LIVE_GAME',
    'SIMULATION_UPDATE',
    'OPPORTUNITY_SUGGESTED',
    'POSITION_OPENED',
    'POSITION_UPDATED',
    'POSITION_CLOSED',
    'PROFIT_SWEEP',
    'COFFER_STATE_CHANGED',
    'PROVIDER_ATTENTION',
    'FUNDING_PROPOSAL'
  )),
  lane TEXT NOT NULL CHECK (lane IN (
    'MONEY','STOCK','FOREX','DEX','CRYPTO','MEME','SPORTS','PREDICTION','METALS'
  )),
  commitment TEXT NOT NULL CHECK (commitment IN (
    'WATCHING','SUGGESTED','COMMITTED','CLOSED','ACCOUNTING','RISK'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  subject_id TEXT,
  route TEXT NOT NULL,
  funded_amount_minor BIGINT CHECK (funded_amount_minor IS NULL OR funded_amount_minor >= 0),
  currency TEXT,
  materiality INTEGER NOT NULL CHECK (materiality BETWEEN 0 AND 100),
  occurred_at TIMESTAMPTZ NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (commitment IN ('COMMITTED','CLOSED') AND funded_amount_minor IS NOT NULL AND funded_amount_minor > 0 AND currency IS NOT NULL)
    OR
    (commitment IN ('WATCHING','SUGGESTED','ACCOUNTING','RISK') AND COALESCE(funded_amount_minor,0) = 0)
  )
);

CREATE INDEX IF NOT EXISTS money_feed_events_user_time_idx
  ON money_feed_events(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS money_feed_events_user_materiality_idx
  ON money_feed_events(user_id, materiality DESC, occurred_at DESC);

REVOKE ALL ON TABLE money_feed_events FROM PUBLIC;
REVOKE ALL ON TABLE money_feed_events FROM anon;
REVOKE ALL ON TABLE money_feed_events FROM authenticated;
REVOKE ALL ON TABLE money_feed_events FROM service_role;
ALTER TABLE money_feed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_feed_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_feed1_service_role ON money_feed_events;
CREATE POLICY money_feed1_service_role ON money_feed_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
GRANT SELECT,INSERT,UPDATE ON money_feed_events TO service_role;

COMMENT ON COLUMN money_coffers.max_deployable_bps IS 'Owner-configured maximum percentage of eligible Coffer cash that strategies may deploy.';
COMMENT ON TABLE money_feed_events IS 'Owner-scoped, non-executing Money/Sports feed evidence. Feed events can describe funded state but cannot authorize execution.';
