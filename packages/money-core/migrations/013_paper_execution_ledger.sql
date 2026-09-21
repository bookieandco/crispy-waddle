CREATE TABLE IF NOT EXISTS money_paper_execution_events (
 event_id TEXT PRIMARY KEY,
 paper_run_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('ORDER','FILL','PORTFOLIO_SNAPSHOT','OUTCOME')),
 occurred_at TIMESTAMPTZ NOT NULL,
 payload_json JSONB NOT NULL,
 payload_hash TEXT NOT NULL,
 evidence_ids TEXT[] NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_money_paper_events_run_time
 ON money_paper_execution_events(paper_run_id,occurred_at,event_id);
