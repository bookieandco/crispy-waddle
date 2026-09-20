-- PERSONALITY-V2.PROD.2 — outcome feedback stays in the canonical reasoning-event/Hippocampus store.
-- No second episodic database is introduced. These additive columns preserve
-- causation/correlation and explicit outcome metadata for conversation feedback.

alter table public.jhadina_reasoning_events
  add column if not exists actor text not null default 'user'
    check (actor in ('user', 'jhadina', 'system', 'external')),
  add column if not exists outcome text,
  add column if not exists correlation_id text,
  add column if not exists causation_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists jhadina_reasoning_events_causation_idx
  on public.jhadina_reasoning_events (user_id, causation_id, occurred_at desc)
  where causation_id is not null;

create index if not exists jhadina_reasoning_events_correlation_idx
  on public.jhadina_reasoning_events (user_id, correlation_id, occurred_at desc)
  where correlation_id is not null;
