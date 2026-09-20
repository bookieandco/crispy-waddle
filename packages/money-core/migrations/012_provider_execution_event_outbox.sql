CREATE TABLE IF NOT EXISTS money_provider_execution_events (
 event_id TEXT PRIMARY KEY,
 provider TEXT NOT NULL,
 provider_event_id TEXT NOT NULL,
 payload_hash TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('CLAIMED','PROCESSED')),
 event_json JSONB NOT NULL,
 claimed_at TIMESTAMPTZ NOT NULL,
 processed_at TIMESTAMPTZ,
 result_json JSONB,
 UNIQUE(provider,provider_event_id)
);
CREATE TABLE IF NOT EXISTS money_execution_outbox (
 outbox_id TEXT PRIMARY KEY,
 aggregate_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 payload_hash TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('PENDING','DELIVERED')),
 delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_money_provider_events_status ON money_provider_execution_events(status,claimed_at);
CREATE INDEX IF NOT EXISTS idx_money_execution_outbox_pending ON money_execution_outbox(status,created_at) WHERE status='PENDING';
