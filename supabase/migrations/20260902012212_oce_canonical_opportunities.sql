create table if not exists public.oce_opportunities (
  id text primary key,
  title text not null,
  family text not null,
  type text not null,
  description text,
  source_url text not null,
  source_name text not null,
  source_id text,
  source_identity text not null,
  amount jsonb,
  deadline timestamptz,
  jurisdiction jsonb,
  eligibility jsonb,
  requirements jsonb not null default '[]'::jsonb,
  scoring_rubric jsonb,
  claims jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  verification_status text not null default 'unverified',
  verification_decision jsonb,
  source_confidence numeric not null default 0 check (source_confidence >= 0 and source_confidence <= 1),
  fit_score numeric,
  opportunity_score numeric,
  expected_value numeric,
  effort_score numeric,
  risk_flags jsonb not null default '[]'::jsonb,
  brokerability text,
  status text not null default 'discovered',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists oce_opportunities_status_idx
  on public.oce_opportunities (status);

create index if not exists oce_opportunities_deadline_idx
  on public.oce_opportunities (deadline)
  where deadline is not null;

create index if not exists oce_opportunities_source_idx
  on public.oce_opportunities (source_id, source_identity);

alter table public.oce_opportunities enable row level security;
revoke all on table public.oce_opportunities from public, anon, authenticated;
grant select, insert, update, delete on table public.oce_opportunities to service_role;

comment on table public.oce_opportunities is 'Canonical OCE opportunity aggregate. Server-side service credentials only; nested provenance, evidence, verification and scoring remain aligned with @jhadina/opportunity-core.';

create index if not exists oce_watchlist_entries_opportunity_idx
  on public.oce_watchlist_entries (opportunity_id);

create index if not exists oce_alert_events_opportunity_idx
  on public.oce_alert_events (opportunity_id);
