alter table public.jhadina_connector_execution_ledger
  alter column proposal_id drop not null,
  alter column idempotency_key drop not null,
  alter column connector_id drop not null,
  alter column operation drop not null,
  alter column actor_id drop not null,
  alter column correlation_id drop not null;

alter table public.jhadina_connector_execution_ledger
  drop constraint if exists jhadina_connector_execution_ledger_idempotency_key_key;

create unique index if not exists uq_jhadina_connector_execution_idempotency
  on public.jhadina_connector_execution_ledger (idempotency_key)
  where idempotency_key is not null;
