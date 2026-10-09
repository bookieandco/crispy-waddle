-- PURSE-AUTO.09-.13 / PAPER ONLY. Prerequisite: purse migration 028 and coffer schema.
-- Never run this against original SHADOW recovery storage prior to independent backup.
CREATE TABLE IF NOT EXISTS public.money_purse_paper_leases (
 charter_id TEXT PRIMARY KEY REFERENCES public.money_purse_charters(charter_id),
 user_id TEXT NOT NULL,
 worker_id TEXT NOT NULL,
 fencing_token BIGINT NOT NULL CHECK (fencing_token > 0),
 acquired_at TIMESTAMPTZ NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 evidence_ids TEXT[] NOT NULL CHECK (cardinality(evidence_ids)>0),
 authority TEXT NOT NULL DEFAULT 'PAPER_LEASE_EVIDENCE_ONLY' CHECK (authority='PAPER_LEASE_EVIDENCE_ONLY'),
 can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
 CHECK (expires_at>acquired_at)
);
CREATE TABLE IF NOT EXISTS public.money_purse_paper_cycles (
 cycle_id TEXT PRIMARY KEY,
 charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
 user_id TEXT NOT NULL,
 worker_id TEXT NOT NULL,
 fencing_token BIGINT NOT NULL CHECK (fencing_token>0),
 economic_sha256 TEXT NOT NULL CHECK (economic_sha256 ~ '^[a-f0-9]{64}$'),
 payload_json JSONB NOT NULL,
 information_cutoff TIMESTAMPTZ NOT NULL,
 created_at_evidence TIMESTAMPTZ NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 authority TEXT NOT NULL DEFAULT 'PAPER_CYCLE_ONLY' CHECK (authority='PAPER_CYCLE_ONLY'),
 can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
 can_sign BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_sign=FALSE),
 can_broadcast BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_broadcast=FALSE),
 can_move_money BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_move_money=FALSE),
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (expires_at>created_at_evidence)
);
CREATE INDEX IF NOT EXISTS purse_paper_cycles_owner_created_idx ON public.money_purse_paper_cycles(user_id,recorded_at DESC);
CREATE INDEX IF NOT EXISTS purse_paper_cycles_charter_cutoff_idx ON public.money_purse_paper_cycles(charter_id,information_cutoff DESC);
CREATE TABLE IF NOT EXISTS public.money_purse_paper_payday_receipts (
 receipt_id TEXT PRIMARY KEY,
 payday_id TEXT NOT NULL UNIQUE,
 charter_id TEXT NOT NULL REFERENCES public.money_purse_charters(charter_id),
 user_id TEXT NOT NULL,
 coffer_id TEXT NOT NULL,
 amount_minor BIGINT NOT NULL CHECK (amount_minor>0),
 currency TEXT NOT NULL CHECK (currency='USD'),
 balanced_journal_sha256 TEXT NOT NULL CHECK (balanced_journal_sha256 ~ '^[a-f0-9]{64}$'),
 receipt_json JSONB NOT NULL,
 created_at_evidence TIMESTAMPTZ NOT NULL,
 authority TEXT NOT NULL DEFAULT 'PAPER_PAYDAY_RECONCILIATION_ONLY' CHECK (authority='PAPER_PAYDAY_RECONCILIATION_ONLY'),
 can_execute BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_execute=FALSE),
 can_move_money BOOLEAN NOT NULL DEFAULT FALSE CHECK (can_move_money=FALSE),
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- These three store classes are internal write surfaces only. Do not grant browser SQL writes.
DO $$
DECLARE t TEXT;
BEGIN
 FOREACH t IN ARRAY ARRAY['money_purse_paper_leases','money_purse_paper_cycles','money_purse_paper_payday_receipts'] LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
   EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',t);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated',t);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
   EXECUTE format('REVOKE ALL ON TABLE public.%I FROM service_role',t);
   IF t='money_purse_paper_leases' THEN
    EXECUTE format('GRANT SELECT,INSERT,UPDATE ON TABLE public.%I TO service_role',t);
   ELSE
    EXECUTE format('GRANT SELECT,INSERT ON TABLE public.%I TO service_role',t);
   END IF;
  END IF;
 END LOOP;
END $$;
-- Local dedicated Postgres uses a tightly scoped application role or table owner,
-- never a public anon/HTTP write path. Durable lease owner is checked in application SQL.
