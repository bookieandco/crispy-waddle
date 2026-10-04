-- Portable bootstrap for a historical Money migration-chain prerequisite.
--
-- The original Postgres execution-attempt store landed before the package
-- migration directory gained migrations 003/004/006. Those migrations assume
-- this base table already exists. Hosted environments acquired the table
-- outside this numbered package chain, but a fresh vanilla PostgreSQL replay
-- does not.
--
-- Apply this AFTER package migration 002 and BEFORE package migration 003.
-- This file is portability scaffolding; it does not change Money authority.

CREATE TABLE IF NOT EXISTS public.money_execution_attempts (
  attempt_id UUID PRIMARY KEY,
  request_id TEXT NOT NULL,
  permit_id TEXT NOT NULL REFERENCES public.money_execution_permits(permit_id) ON DELETE RESTRICT,
  action_fingerprint TEXT NOT NULL,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (
    state IN ('STARTED','SUCCEEDED','FAILED','UNKNOWN','RECOVERY_REQUIRED')
  ),
  provider_reference TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  recovery_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((state = 'STARTED' AND completed_at IS NULL) OR state <> 'STARTED')
);

CREATE INDEX IF NOT EXISTS money_execution_attempts_request_idx
  ON public.money_execution_attempts(request_id, started_at DESC);

CREATE INDEX IF NOT EXISTS money_execution_attempts_recovery_idx
  ON public.money_execution_attempts(recovery_required, state, started_at ASC)
  WHERE recovery_required = TRUE OR state IN ('UNKNOWN','RECOVERY_REQUIRED');

COMMENT ON TABLE public.money_execution_attempts IS
  'Durable provider execution-attempt ledger. Portable bootstrap for the historical Money migration prerequisite.';
