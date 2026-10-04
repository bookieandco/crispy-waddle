-- TIKTOK / BUSINESS FACTORY PIPELINE FOLD
-- Keep durable Venture runtime receipt kinds aligned with the canonical
-- Side Hustle Lab runtime. This migration expands the original constraint;
-- it grants no new execution, publishing, payment, outreach, or money authority.

alter table public.jhadina_venture_runtime_receipts
  drop constraint if exists jhadina_venture_runtime_receipts_kind_check;

alter table public.jhadina_venture_runtime_receipts
  add constraint jhadina_venture_runtime_receipts_kind_check
  check (
    kind in (
      'market_scout',
      'supervisor',
      'spatial_projection',
      'research_completion',
      'validation_admission',
      'experiment_bridge',
      'validation_result',
      'outcome_bridge',
      'memory_commit',
      'maturity_assessment',
      'persona_projection',
      'live_final'
    )
  );

comment on constraint jhadina_venture_runtime_receipts_kind_check
  on public.jhadina_venture_runtime_receipts
  is 'Canonical Side Hustle / Venture Lab runtime receipt taxonomy. Receipt rows are evidence records only and do not grant external action authority.';
