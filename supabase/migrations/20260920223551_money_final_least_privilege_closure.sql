-- MONEY-FINAL least-privilege closure.
-- Applied to Swlc as 20260920223551_money_final_least_privilege_closure.
--
-- Bank ownership metadata is client-readable only. All ownership lifecycle
-- mutations are server/service-role operations after verified request identity.
drop policy if exists "money bank accounts are owner insertable"
  on public.jhadina_money_bank_accounts;
drop policy if exists "money bank accounts are owner mutable"
  on public.jhadina_money_bank_accounts;
drop policy if exists "money bank accounts are owner deletable"
  on public.jhadina_money_bank_accounts;

drop policy if exists "money bank connections are owner insertable"
  on public.jhadina_money_bank_connections;
drop policy if exists "money bank connections are owner mutable"
  on public.jhadina_money_bank_connections;
drop policy if exists "money bank connections are owner deletable"
  on public.jhadina_money_bank_connections;

revoke insert, update, delete, truncate, references, trigger
  on public.jhadina_money_bank_accounts,
     public.jhadina_money_bank_connections
  from anon, authenticated;

-- Money research workflow state is backend-owned. These tables already had RLS
-- enabled with no client policies, but retained broad default Data API grants.
-- Remove the latent grant layer so a future policy cannot accidentally expose
-- the workflow without an explicit access-model change.
revoke all on public.money_research_cases,
              public.money_research_tasks,
              public.money_research_evidence
  from anon, authenticated;
