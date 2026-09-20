-- SHARK-QA.16C: outcome labels are evidence-derived classifications, not immutable facts.
-- Persist the observation/evaluation time so older evidence cannot overwrite a newer label.
alter table public.jhadina_token_launches
  add column if not exists outcome_observed_at timestamptz;

create index if not exists jhadina_token_launches_outcome_observed_idx
  on public.jhadina_token_launches (outcome_observed_at desc)
  where outcome_observed_at is not null;
