-- LOCAL-GOV.5F — authoritative .gov domain registry bootstrap.

create table if not exists public.jhadina_public_official_domains (
  domain text primary key,
  raw_domain_type text not null,
  domain_type text not null
    check (domain_type in ('state','county','city','school_district','special_district','other')),
  organization_name text not null,
  suborganization_name text,
  city text,
  state_code text,
  matched_jurisdiction_id text references public.jhadina_public_jurisdictions(id) on delete set null,
  match_score double precision check (match_score is null or (match_score >= 0 and match_score <= 1)),
  match_reason text,
  source_url text not null,
  observed_at timestamptz not null,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_public_official_domains_jurisdiction_idx
  on public.jhadina_public_official_domains (matched_jurisdiction_id, match_score desc);

create index if not exists jhadina_public_official_domains_state_type_idx
  on public.jhadina_public_official_domains (state_code, domain_type, match_score desc);

alter table public.jhadina_public_official_domains enable row level security;
revoke all on table public.jhadina_public_official_domains from anon, authenticated;
grant all on table public.jhadina_public_official_domains to service_role;
