-- Spatial Reality Engine (SPATIAL-04).
-- Raw observations/evidence do not become canonical reality automatically.
-- Candidates and admission decisions are separate append-only records.

create table if not exists public.jhadina_spatial_reality_candidates (
  candidate_id text primary key,
  entity_id text not null,
  state jsonb not null default '{}'::jsonb,
  determination text not null check (determination in ('observed','corroborated','verified','derived')),
  evidence_refs jsonb not null default '[]'::jsonb,
  observation_refs jsonb not null default '[]'::jsonb,
  fusion_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  valid_from timestamptz,
  valid_to timestamptz,
  limitations jsonb not null default '[]'::jsonb
);

create table if not exists public.jhadina_spatial_reality_admissions (
  admission_id text primary key,
  candidate_id text not null references public.jhadina_spatial_reality_candidates(candidate_id),
  decision text not null check (decision in ('ACCEPT','REJECT','DEFER','SUPERSEDE')),
  verifier text not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  rationale jsonb not null default '[]'::jsonb,
  created_at timestamptz not null
);

create index if not exists jhadina_spatial_reality_candidates_entity_idx
  on public.jhadina_spatial_reality_candidates (entity_id, created_at desc);

create index if not exists jhadina_spatial_reality_admissions_candidate_idx
  on public.jhadina_spatial_reality_admissions (candidate_id, created_at desc);

alter table public.jhadina_spatial_reality_candidates enable row level security;
alter table public.jhadina_spatial_reality_admissions enable row level security;

create policy jhadina_spatial_reality_candidates_service_role_only
  on public.jhadina_spatial_reality_candidates as restrictive for all
  to service_role using (true) with check (true);

create policy jhadina_spatial_reality_admissions_service_role_only
  on public.jhadina_spatial_reality_admissions as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_spatial_reality_candidates from anon, authenticated;
revoke all on public.jhadina_spatial_reality_admissions from anon, authenticated;

-- Reality is append-only. Corrections are represented by new admission records,
-- never UPDATE/DELETE of historical candidates or admissions.
create or replace function public.jhadina_spatial_reality_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'SPATIAL_REALITY_APPEND_ONLY';
end;
$$;

create trigger jhadina_spatial_reality_candidates_no_update_delete
before update or delete on public.jhadina_spatial_reality_candidates
for each row execute function public.jhadina_spatial_reality_append_only();

create trigger jhadina_spatial_reality_admissions_no_update_delete
before update or delete on public.jhadina_spatial_reality_admissions
for each row execute function public.jhadina_spatial_reality_append_only();
