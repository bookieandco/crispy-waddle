-- Missing durable execution-attempt base table.
--
-- The execution-attempt runtime was added before migrations 003/004/006, but
-- the package migration chain never received the table-creation migration.
-- Keep this idempotent so existing deployments that already have the table are
-- not disturbed while fresh PostgreSQL/Homebase replays become complete.

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
  CHECK (
    (state = 'STARTED' AND completed_at IS NULL)
    OR (state <> 'STARTED')
  )
);

CREATE INDEX IF NOT EXISTS money_execution_attempts_request_idx
  ON public.money_execution_attempts(request_id, started_at DESC);

CREATE INDEX IF NOT EXISTS money_execution_attempts_recovery_idx
  ON public.money_execution_attempts(recovery_required, state, started_at ASC)
  WHERE recovery_required = TRUE OR state IN ('UNKNOWN','RECOVERY_REQUIRED');

COMMENT ON TABLE public.money_execution_attempts IS
  'Durable provider execution-attempt ledger. UNKNOWN/recovery states prevent blind duplicate external submission.';
