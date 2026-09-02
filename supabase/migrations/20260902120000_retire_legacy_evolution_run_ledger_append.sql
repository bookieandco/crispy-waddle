-- Retire the legacy client-supplied evolution ledger append RPC.
--
-- The canonical append_jhadina_evolution_run_ledger RPC is the sole write
-- authority. It derives sequence, event_id, previous_hash, and hash inside
-- Postgres under a transaction-scoped advisory lock. The legacy RPC accepted
-- those integrity fields from callers and therefore must not remain executable.

revoke all on function public.jhadina_evolution_run_ledger_append(
  integer,
  text,
  bigint,
  text,
  text,
  timestamptz,
  jsonb,
  text,
  text
) from public;

revoke all on function public.jhadina_evolution_run_ledger_append(
  integer,
  text,
  bigint,
  text,
  text,
  timestamptz,
  jsonb,
  text,
  text
) from anon;

revoke all on function public.jhadina_evolution_run_ledger_append(
  integer,
  text,
  bigint,
  text,
  text,
  timestamptz,
  jsonb,
  text,
  text
) from authenticated;

revoke all on function public.jhadina_evolution_run_ledger_append(
  integer,
  text,
  bigint,
  text,
  text,
  timestamptz,
  jsonb,
  text,
  text
) from service_role;
