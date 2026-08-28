-- Jhadina Experience event ledger.
--
-- Experience is append-only, idempotent by event id, and explicitly scoped
-- to the owning user. The current Jhadina web app does not yet have a real
-- end-user Supabase Auth session, so auth.uid()-based RLS would be misleading.
-- Until Identity/Ask Jhadina auth is real, access is restricted to service_role
-- and the application storage boundary must preserve scope.ownerId -> user_id.
-- Revisit the policies when real end-user identity is available.

create table if not exists public.jhadina_experience_events (
  id text primary key,
  user_id text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null,
  domain text,
  actor text not null,
  content text not null,
  evidence jsonb not null default '[]'::jsonb,
  schema_version integer not null,
  event_type text not null,
  correlation_id text,
  causation_id text,
  outcome text,
  sensitivity text not null check (sensitivity in ('public', 'private', 'sensitive', 'restricted')),
  provenance jsonb not null default '{}'::jsonb,
  metadata jsonb
);

create index if not exists jhadina_experience_events_user_occurred_idx
  on public.jhadina_experience_events (user_id, occurred_at desc);

create index if not exists jhadina_experience_events_user_recorded_idx
  on public.jhadina_experience_events (user_id, recorded_at desc);

create index if not exists jhadina_experience_events_correlation_idx
  on public.jhadina_experience_events (user_id, correlation_id);

alter table public.jhadina_experience_events enable row level security;

create policy jhadina_experience_events_service_role_only
  on public.jhadina_experience_events as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_experience_events from anon, authenticated;
