alter table public.jhadina_connector_execution_ledger
  add column if not exists recovery_of_execution_id uuid references public.jhadina_connector_execution_ledger(execution_id);

create index if not exists idx_jhadina_connector_execution_recovery_of
  on public.jhadina_connector_execution_ledger (recovery_of_execution_id)
  where recovery_of_execution_id is not null;

create or replace function public.jhadina_claim_recovery_attempt(
  p_original_execution_id uuid,
  p_proposal_hash text,
  p_new_execution_id text,
  p_new_idempotency_key text,
  p_connector_id text,
  p_operation text,
  p_actor_id text,
  p_correlation_id text,
  p_approval_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.jhadina_connector_execution_ledger
    where execution_id = p_original_execution_id
      and proposal_hash = p_proposal_hash
      and state = 'recovery_required'
  ) then return false; end if;

  if not exists (
    select 1 from public.jhadina_connector_execution_reconciliation
    where execution_id = p_original_execution_id
      and proposal_hash = p_proposal_hash
      and status = 'confirmed_not_executed'
  ) then return false; end if;

  insert into public.jhadina_connector_execution_ledger (
    execution_id, approval_id, proposal_hash, idempotency_key,
    connector_id, operation, actor_id, correlation_id, state,
    started_at, recovery_of_execution_id
  ) values (
    p_new_execution_id::uuid, p_approval_id, p_proposal_hash, p_new_idempotency_key,
    p_connector_id, p_operation, p_actor_id, p_correlation_id, 'executing',
    now(), p_original_execution_id
  );
  return true;
exception when unique_violation then return false;
end;
$$;

revoke all on function public.jhadina_claim_recovery_attempt(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
