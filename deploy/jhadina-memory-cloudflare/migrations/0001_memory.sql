-- Cloudflare D1-backed Jhadina MemoryStorage, private Worker binding only.
-- This is a NEW schema; no Supabase data is read or migrated automatically.
-- Keep historical retired rows for audit; app Context must use active memory only.
CREATE TABLE IF NOT EXISTS jhadina_memory_records (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('memory','candidate','reasoning','timeline')),
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','RETIRED','EVENT')),
  sort_at TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);
CREATE INDEX IF NOT EXISTS jhadina_memory_records_scope
  ON jhadina_memory_records(owner_id,kind,status,sort_at DESC);
CREATE INDEX IF NOT EXISTS jhadina_memory_records_kind
  ON jhadina_memory_records(kind,owner_id,sort_at DESC);
