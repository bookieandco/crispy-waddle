-- Repair migration: make a fresh database reproduce the durable connector recovery
-- contract already present in production. This intentionally consolidates the
-- previously missing recovery migrations into one idempotent repair migration.

alter table public.jhadina_connector_execution_ledger
  alter column approval_id drop not null,
  alter column proposal_id drop not null,
  alter column idempotency_key drop not null,
  alter column connector_id drop not null,
  alter column operation drop not null,
  alter column actor_id drop not null,
  alter column correlation_id drop not null;

alter table public.jhadina_connector_execution_ledger
  add column if not exists recovery_of_execution_id uuid,
  add column if not exists recovery_lease_id text,
  add column if not exists recovery_lease_expires_at timestamptz;

alter table public.jhadina_connector_execution_ledger
  drop constraint if exists jhadina_connector_execution_ledger_state_check;

alter table public.jhadina_connector_execution_ledger
  add constraint jhadina_connector_execution_ledger_state_check
  check (state = any (array['executing','succeeded','failed','recovery_required','recovered']::text[]));

create index if not exists idx_jhadina_connector_execution_recovery_of
  on public.jhadina_connector_execution_ledger (recovery_of_execution_id)
  where recovery_of_execution_id is not null;

create unique index if not exists jhadina_connector_execution_ledger_recovery_lease_uidx
  on public.jhadina_connector_execution_ledger (recovery_lease_id)
  where recovery_lease_id is not null;

create unique index if not exists uq_jhadina_connector_execution_active_recovery_parent
  on public.jhadina_connector_execution_ledger (recovery_of_execution_id)
  where recovery_of_execution_id is not null
    and state in ('executing','recovery_required');

create index if not exists idx_jhadina_connector_execution_recovery_lease
  on public.jhadina_connector_execution_ledger (recovery_lease_id, recovery_lease_expires_at)
  where recovery_lease_id is not null;

create table if not exists public.jhadina_connector_execution_reconciliation (
  reconciliation_id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.jhadina_connector_execution_ledger(execution_id),
  proposal_hash text not null,
  status text not null check (status in ('unknown','confirmed_executed','confirmed_not_executed','indeterminate')),
  provider_operation text,
  provider_reference text,
  observed_state text,
  evidence jsonb not null default '{}'::jsonb,
  evidence_hash text not null,
  adapter_id text not null,
  adapter_version integer not null check (adapter_version >= 1),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_jhadina_execution_reconciliation_execution
  on public.jhadina_connector_execution_reconciliation (execution_id, checked_at desc);

create unique index if not exists uq_jhadina_execution_reconciliation_evidence
  on public.jhadina_connector_execution_reconciliation (execution_id, evidence_hash);

alter table public.jhadina_connector_execution_ledger enable row level security;
alter table public.jhadina_connector_execution_reconciliation enable row level security;

create or replace function public.jhadina_claim_recovery_attempt(
  p_original_execution_id uuid,
  p_proposal_hash text,
  p_new_execution_id text,
  p_new_idempotency_key text,
  p_recovery_lease_id text,
  p_connector_id text,
  p_operation text,
  p_actor_id text,
  p_correlation_id text
) returns boolean
language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not exists (
    select 1 from public.jhadina_connector_execution_ledger
    where execution_id = p_original_execution_id
      and proposal_hash = p_proposal_hash
      and state = 'recovery_required'
  ) then return false; end if;

  if exists (
    select 1 from public.jhadina_connector_execution_ledger
    where recovery_of_execution_id = p_original_execution_id
      and state in ('executing','recovery_required')
  ) then return false; end if;

  if not exists (
    select 1 from public.jhadina_connector_execution_reconciliation
    where execution_id = p_original_execution_id
      and proposal_hash = p_proposal_hash
      and status = 'confirmed_not_executed'
  ) then return false; end if;

  insert into public.jhadina_connector_execution_ledger (
    execution_id, approval_id, proposal_id, proposal_hash, idempotency_key,
    recovery_lease_id, recovery_lease_expires_at, connector_id, operation,
    actor_id, correlation_id, state, started_at, recovery_of_execution_id
  ) values (
    p_new_execution_id::uuid, null, null, p_proposal_hash, p_new_idempotency_key,
    p_recovery_lease_id, now() + interval '5 minutes', p_connector_id,
    p_operation, p_actor_id, p_correlation_id, 'executing', now(),
    p_original_execution_id
  );
  return true;
exception when unique_violation then return false;
when invalid_text_representation then return false;
end;
$$;

create or replace function public.jhadina_adopt_recovery_execution(
  p_execution_id text,
  p_proposal_hash text,
  p_recovery_lease_id text
) returns boolean
language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare adopted boolean := false;
begin
  update public.jhadina_connector_execution_ledger
  set recovery_lease_id = null,
      recovery_lease_expires_at = null,
      updated_at = now()
  where execution_id = p_execution_id::uuid
    and proposal_hash = p_proposal_hash
    and state = 'executing'
    and recovery_lease_id = p_recovery_lease_id
    and recovery_lease_expires_at > now();
  adopted := found;
  return adopted;
exception when invalid_text_representation then return false;
end;
$$;

create or replace function public.jhadina_complete_recovery_execution(
  p_execution_id uuid,
  p_original_execution_id uuid,
  p_proposal_hash text,
  p_response jsonb,
  p_completed_at timestamptz default now()
) returns boolean
language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  update public.jhadina_connector_execution_ledger
  set state = 'succeeded', response = p_response, error = null,
      completed_at = p_completed_at, updated_at = p_completed_at
  where execution_id = p_execution_id
    and proposal_hash = p_proposal_hash
    and recovery_of_execution_id = p_original_execution_id
    and state = 'executing';
  if not found then return false; end if;

  update public.jhadina_connector_execution_ledger
  set state = 'recovered', response = p_response, error = null,
      completed_at = p_completed_at, updated_at = p_completed_at
  where execution_id = p_original_execution_id
    and proposal_hash = p_proposal_hash
    and state = 'recovery_required';
  if not found then
    raise exception 'Recovery parent cannot be resolved: %', p_original_execution_id;
  end if;

  return true;
end;
$$;
