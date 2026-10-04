-- Reconcile Venture runtime receipt kinds with the live TypeScript contract.
-- The original 20261001163000 table constraint admitted only the earliest
-- five kinds while later Side Hustle Lab runtime code added additional
-- evidence-only receipts. This migration changes validation only; it grants
-- no new execution authority.

alter table public.jhadina_venture_runtime_receipts
  drop constraint if exists jhadina_venture_runtime_receipts_kind_check;

alter table public.jhadina_venture_runtime_receipts
  add constraint jhadina_venture_runtime_receipts_kind_check
  check (kind in (
    'market_scout',
    'supervisor',
    'spatial_projection',
    'business_pipeline',
    'product_sniper',
    'product_sniper_learning',
    'research_completion',
    'validation_admission',
    'experiment_bridge',
    'validation_result',
    'outcome_bridge',
    'memory_commit',
    'maturity_assessment',
    'persona_projection',
    'live_final'
  ));
