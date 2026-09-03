ALTER TABLE public.money_execution_attempts
  ADD COLUMN IF NOT EXISTS action_snapshot jsonb;

UPDATE public.money_execution_attempts
SET action_snapshot = jsonb_build_object(
  'actionId', request_id,
  'userId', NULL,
  'capability', operation,
  'provider', provider,
  'amount', NULL,
  'currency', NULL
)
WHERE action_snapshot IS NULL;

ALTER TABLE public.money_execution_attempts
  ALTER COLUMN action_snapshot SET NOT NULL;

ALTER TABLE public.money_execution_attempts
  ADD CONSTRAINT money_execution_attempts_action_snapshot_object_check
  CHECK (jsonb_typeof(action_snapshot) = 'object');
