-- SHARK-CLOUDFLARE.FREE.01-.08
-- Entirely public-market research. Apply ONLY on approved new D1 database.
-- Not a migration of the canonical Python/SQLite evidence schema.
CREATE TABLE IF NOT EXISTS daily_budget (
  utc_day TEXT PRIMARY KEY, cycles INTEGER NOT NULL DEFAULT 0
    CHECK(cycles BETWEEN 0 AND 288)
);
CREATE TABLE IF NOT EXISTS cycles (
  scheduled_ms INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('STARTED','DONE','ERROR')),
  new_count INTEGER NOT NULL DEFAULT 0,
  follow_count INTEGER NOT NULL DEFAULT 0,
  invalid_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS watch (
  mint TEXT PRIMARY KEY,
  first_at TEXT NOT NULL,
  first_ms INTEGER NOT NULL,
  pair TEXT NOT NULL,
  initial_usd REAL NOT NULL CHECK(initial_usd > 0),
  last_check_ms INTEGER NOT NULL,
  last_usd REAL NOT NULL CHECK(last_usd > 0),
  state TEXT NOT NULL CHECK(state IN ('OPEN','PRICE_ONLY','CENSORED')),
  risk_flags TEXT NOT NULL,
  last_provider TEXT NOT NULL DEFAULT 'UNATTESTED_PUBLIC_DEX_RPC'
);
CREATE INDEX IF NOT EXISTS watch_due ON watch(state, first_ms, last_check_ms);
CREATE TABLE IF NOT EXISTS observations (
  mint TEXT NOT NULL,
  observed_ms INTEGER NOT NULL,
  pair TEXT NOT NULL,
  price_usd REAL NOT NULL CHECK(price_usd > 0),
  liquidity_usd REAL NOT NULL CHECK(liquidity_usd >= 0),
  source TEXT NOT NULL DEFAULT 'PUBLIC_DEX_RPC_UNATTESTED',
  PRIMARY KEY(mint, observed_ms),
  FOREIGN KEY(mint) REFERENCES watch(mint)
);
CREATE TABLE IF NOT EXISTS outcomes (
  mint TEXT PRIMARY KEY,
  at_ms INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('PRICE_ONLY_UNVERIFIED','HORIZON_MISSED_CENSORED','MISSING_PROVIDER_CENSORED','PAIR_SWITCH_CENSORED')),
  return_pct REAL,
  source TEXT NOT NULL DEFAULT 'PUBLIC_DEX_RPC_UNATTESTED',
  FOREIGN KEY(mint) REFERENCES watch(mint)
);
CREATE TABLE IF NOT EXISTS alert_outbox (
  event_key TEXT PRIMARY KEY,
  mint TEXT NOT NULL,
  created_ms INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('ATTEMPTED','ACKNOWLEDGED','UNCERTAIN_NO_RETRY'))
);
