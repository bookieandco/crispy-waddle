-- SPATIAL-03: durable immutable spatial evidence.
-- Evidence is source material, not canonical reality. It is append-only,
-- content-addressed, and restricted to the service role.

create table if not exists public.jhadina_spatial_evidence (
  evidence_id text primary key,
  observation_id text not null,
  provider text not null,
  record_id text,
  attribution text,
  observed_at timestamptz,
  received_at timestamptz not null,
  completeness text not null check (completeness in ('complete','partial','unknown')),
  coverage text not null check (coverage in ('known','partial','unknown')),
  freshness text not null check (freshness in ('fresh','stale','unknown')),
  payload jsonb not null,
  adapter text not null,
  adapter_version text not null,
  content_hash text not null unique check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists jhadina_spatial_evidence_observation_idx
  on public.jhadina_spatial_evidence (observation_id, received_at desc);

create index if not exists jhadina_spatial_evidence_provider_idx
  on public.jhadina_spatial_evidence (provider, received_at desc);

-- Defense in depth: even privileged application code cannot mutate evidence rows.
create or replace function public.reject_jhadina_spatial_evidence_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'SPATIAL_EVIDENCE_APPEND_ONLY';
end;
$$;

drop trigger if exists jhadina_spatial_evidence_no_update on public.jhadina_spatial_evidence;
create trigger jhadina_spatial_evidence_no_update
before update on public.jhadina_spatial_evidence
for each row execute function public.reject_jhadina_spatial_evidence_mutation();

drop trigger if exists jhadina_spatial_evidence_no_delete on public.jhadina_spatial_evidence;
create trigger jhadina_spatial_evidence_no_delete
before delete on public.jhadina_spatial_evidence
for each row execute function public.reject_jhadina_spatial_evidence_mutation();

alter table public.jhadina_spatial_evidence enable row level security;

create policy jhadina_spatial_evidence_service_role_only
  on public.jhadina_spatial_evidence as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_spatial_evidence from anon, authenticated;
revoke update, delete on public.jhadina_spatial_evidence from service_role;
grant select, insert on public.jhadina_spatial_evidence to service_role;
