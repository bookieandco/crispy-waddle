-- SHARK-QA.16B: canonical schema reconciliation.
--
-- Earlier SHARK migrations intentionally used CREATE TABLE IF NOT EXISTS while
-- the ingestion and outcome-history work landed independently. Do not rewrite
-- those already-applied migrations. Reconcile the final contract here so fresh
-- and partially migrated databases converge on the same persistence surface.

alter table public.jhadina_token_launches
  alter column source set default 'unknown',
  alter column evidence_ids set default '{}';

alter table public.jhadina_token_actor_edges
  alter column evidence_ids set default '{}';

alter table public.jhadina_launch_outcome_observations
  alter column evidence_ids set default '{}';

alter table public.jhadina_actor_outcome_history
  alter column evidence_ids set default '{}';

alter table public.jhadina_launch_outcome_evaluations
  alter column evidence_ids set default '{}',
  alter column reasons set default '{}';

-- PostgREST/Supabase upserts use this identity pair as the canonical launch key.
create unique index if not exists jhadina_token_launches_chain_token_uidx
  on public.jhadina_token_launches (chain_id, token_address);

-- Webhook observation identity must not be attached to more than one launch row.
create unique index if not exists jhadina_token_launches_observation_uidx
  on public.jhadina_token_launches (observation_id)
  where observation_id is not null;

-- Actor edges persist only canonical graph relationship values.
alter table public.jhadina_token_actor_edges
  drop constraint if exists jhadina_token_actor_edges_role_check;
alter table public.jhadina_token_actor_edges
  add constraint jhadina_token_actor_edges_role_check
  check (role in (
    'controls',
    'funded-by',
    'deployed',
    'provided-liquidity',
    'bought-early',
    'associated-with',
    'same-entity'
  ));

-- Keep the final persistence plane private even if an older migration created
-- authenticated SELECT policies.
alter table public.jhadina_token_launches enable row level security;
alter table public.jhadina_token_actor_edges enable row level security;
alter table public.jhadina_launch_outcome_observations enable row level security;
alter table public.jhadina_actor_outcome_history enable row level security;
alter table public.jhadina_launch_outcome_evaluations enable row level security;

drop policy if exists jhadina_token_launches_select_authenticated
  on public.jhadina_token_launches;
drop policy if exists jhadina_token_actor_edges_select_authenticated
  on public.jhadina_token_actor_edges;
drop policy if exists jhadina_launch_outcome_observations_select_authenticated
  on public.jhadina_launch_outcome_observations;
drop policy if exists jhadina_actor_outcome_history_select_authenticated
  on public.jhadina_actor_outcome_history;
drop policy if exists jhadina_launch_outcome_evaluations_select_authenticated
  on public.jhadina_launch_outcome_evaluations;
