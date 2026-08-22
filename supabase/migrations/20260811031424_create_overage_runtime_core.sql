create table if not exists public.overage_opportunities (
  id uuid primary key default gen_random_uuid(),
  opportunity_type text not null,
  status text not null default 'discovered',
  jurisdiction_id text,
  source_id text,
  property_id text,
  candidate_name text,
  estimated_amount numeric,
  priority_score numeric,
  priority_band text,
  confidence numeric,
  eligibility_state text not null default 'unknown',
  evidence_complete boolean not null default false,
  deadline_at timestamptz,
  blockers jsonb not null default '[]'::jsonb,
  score_factors jsonb not null default '{}'::jsonb,
  provenance_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.overage_evidence (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.overage_opportunities(id) on delete cascade,
  evidence_type text not null,
  source_url text,
  source_authority text,
  document_ref text,
  fingerprint text,
  observed_at timestamptz,
  verified_at timestamptz,
  verification_state text not null default 'unverified',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.overage_action_envelopes (
  id uuid primary key default gen_random_uuid(),
  action_id text not null unique,
  opportunity_id uuid references public.overage_opportunities(id) on delete set null,
  action_type text not null,
  capability text not null,
  actor_identity_ref text,
  policy_decision_ref text,
  approval_ref text,
  provenance_refs jsonb not null default '[]'::jsonb,
  idempotency_key text not null unique,
  status text not null default 'requested',
  provider_ref text,
  safe_error_class text,
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz
);

create index if not exists overage_opportunities_priority_idx on public.overage_opportunities (priority_score desc, updated_at desc);
create index if not exists overage_opportunities_status_idx on public.overage_opportunities (status);
create index if not exists overage_opportunities_deadline_idx on public.overage_opportunities (deadline_at) where deadline_at is not null;
create index if not exists overage_evidence_opportunity_idx on public.overage_evidence (opportunity_id);
create index if not exists overage_actions_opportunity_idx on public.overage_action_envelopes (opportunity_id);

alter table public.overage_opportunities enable row level security;
alter table public.overage_evidence enable row level security;
alter table public.overage_action_envelopes enable row level security;

create policy "overage opportunities owner access" on public.overage_opportunities
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy "overage evidence owner access" on public.overage_evidence
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy "overage action envelopes owner access" on public.overage_action_envelopes
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
