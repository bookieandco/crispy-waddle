-- OCE 6.74-6.76 persistence boundary.
-- Append-only alert/delivery/feedback records with explicit idempotency constraints.

create unique index if not exists corporate_intelligence_evidence_entity_fingerprint_uidx
  on public.corporate_intelligence_evidence (entity_id, fingerprint);

create unique index if not exists corporate_intelligence_relationship_identity_uidx
  on public.corporate_intelligence_relationships
  (from_entity_id, to_entity_id, relationship_type, source, source_reference);

create table if not exists public.oce_watchlist_entries (
  id text primary key,
  user_id uuid not null references auth.users(id),
  opportunity_id text not null,
  principal_id text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.oce_alert_events (
  id text primary key,
  fingerprint text not null,
  watchlist_entry_id text not null references public.oce_watchlist_entries(id),
  opportunity_id text not null,
  principal_id text,
  alert_type text not null,
  priority text not null,
  previous_state jsonb,
  new_state jsonb,
  change_reason text not null,
  supporting_evidence_ids jsonb not null default '[]'::jsonb,
  detected_at timestamptz not null,
  engine_version text not null,
  created_at timestamptz not null default now(),
  unique (watchlist_entry_id, fingerprint)
);

create table if not exists public.oce_alert_deliveries (
  id text primary key,
  alert_id text not null references public.oce_alert_events(id),
  recipient_id uuid not null references auth.users(id),
  channel text not null,
  priority text not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  attempt integer not null default 0 check (attempt >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oce_feedback_events (
  id text primary key,
  kind text not null,
  event_type text not null,
  opportunity_id text,
  principal_id text,
  source_evidence_ids jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  schema_version integer not null default 1
);

create table if not exists public.oce_versioned_assessments (
  id text primary key,
  subject_id text not null,
  assessment_type text not null,
  score numeric not null check (score >= 0 and score <= 100),
  basis_evidence_ids jsonb not null default '[]'::jsonb,
  supersedes_id text references public.oce_versioned_assessments(id),
  assessed_at timestamptz not null,
  engine_version text not null,
  created_at timestamptz not null default now()
);

alter table public.oce_watchlist_entries enable row level security;
alter table public.oce_alert_events enable row level security;
alter table public.oce_alert_deliveries enable row level security;
alter table public.oce_feedback_events enable row level security;
alter table public.oce_versioned_assessments enable row level security;

-- Service-role/server-side OCE persistence is the initial write path.
-- No client policies are added here; authenticated client access must be explicitly designed later.
