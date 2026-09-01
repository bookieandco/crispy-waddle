alter table public.jhadina_connector_execution_ledger
  drop constraint if exists jhadina_connector_execution_ledger_state_check;

alter table public.jhadina_connector_execution_ledger
  add constraint jhadina_connector_execution_ledger_state_check
  check (state in ('executing','succeeded','failed','recovery_required'));
