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
  checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (execution_id, evidence_hash)
);

create index if not exists idx_jhadina_connector_reconciliation_execution_checked
  on public.jhadina_connector_execution_reconciliation (execution_id, checked_at desc);

alter table public.jhadina_connector_execution_reconciliation enable row level security;
revoke all on public.jhadina_connector_execution_reconciliation from anon, authenticated;
