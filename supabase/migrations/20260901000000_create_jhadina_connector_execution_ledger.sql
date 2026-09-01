create table if not exists public.jhadina_connector_execution_ledger (
  execution_id uuid primary key default gen_random_uuid(),
  approval_id text not null,
  proposal_id text not null,
  proposal_hash text not null,
  idempotency_key text not null,
  connector_id text not null,
  operation text not null,
  actor_id text not null,
  correlation_id text not null,
  state text not null check (state in ('executing','succeeded','failed')),
  response jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (approval_id),
  unique (idempotency_key)
);

create index if not exists idx_jhadina_connector_execution_proposal
  on public.jhadina_connector_execution_ledger (proposal_id);

create index if not exists idx_jhadina_connector_execution_state
  on public.jhadina_connector_execution_ledger (state, updated_at);

alter table public.jhadina_connector_execution_ledger enable row level security;
revoke all on public.jhadina_connector_execution_ledger from anon, authenticated;
