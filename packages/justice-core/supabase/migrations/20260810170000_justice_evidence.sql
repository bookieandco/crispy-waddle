create table if not exists public.justice_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  jurisdiction text,
  authority_level text not null check (authority_level in ('PRIMARY','OFFICIAL_GUIDANCE','PUBLIC_RECORD','SECONDARY','DISCOVERY')),
  created_at timestamptz not null default now()
);

create table if not exists public.justice_evidence (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.justice_sources(id),
  jurisdiction text not null,
  title text not null,
  citation text,
  effective_from date,
  effective_to date,
  retrieved_at timestamptz not null,
  content_hash text not null,
  content text not null,
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','VERIFIED','REJECTED','STALE')),
  provenance jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.justice_verifications (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.justice_evidence(id),
  status text not null check (status in ('UNVERIFIED','VERIFIED','REJECTED','STALE')),
  checked_at timestamptz not null,
  checks jsonb not null default '[]'::jsonb,
  notes text
);

create index if not exists justice_evidence_source_idx on public.justice_evidence(source_id);
create index if not exists justice_evidence_jurisdiction_idx on public.justice_evidence(jurisdiction);
create index if not exists justice_evidence_hash_idx on public.justice_evidence(content_hash);
create index if not exists justice_verifications_evidence_idx on public.justice_verifications(evidence_id);

alter table public.justice_sources enable row level security;
alter table public.justice_evidence enable row level security;
alter table public.justice_verifications enable row level security;

revoke all on public.justice_sources from anon, authenticated;
revoke all on public.justice_evidence from anon, authenticated;
revoke all on public.justice_verifications from anon, authenticated;
