-- Normal-project Director final-QC evidence and decisions.
-- Separate from the four-fixture production certification matrix.

create table if not exists public.director_project_final_qc_evidence (
  project_id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  final_master_asset_id text,
  timeline_version_id text,
  final_inspection jsonb,
  coherence jsonb,
  audio_stem_roles text[] not null default '{}',
  audio_evidence_ids text[] not null default '{}',
  narration_evidence_ids text[] not null default '{}',
  lip_sync_evidence_ids text[] not null default '{}',
  nle_export_evidence_ids text[] not null default '{}',
  evidence_ids text[] not null default '{}',
  source text not null default 'director-post-runtime',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (final_inspection is null or jsonb_typeof(final_inspection)='object'),
  check (coherence is null or jsonb_typeof(coherence)='object')
);

create table if not exists public.director_project_final_qc_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  admissible boolean not null,
  reasons text[] not null default '{}',
  decision jsonb not null,
  evidence_snapshot jsonb not null,
  evaluated_at timestamptz not null default now(),
  check (jsonb_typeof(decision)='object'),
  check (jsonb_typeof(evidence_snapshot)='object')
);

create index if not exists director_project_final_qc_receipts_project_idx
  on public.director_project_final_qc_receipts(project_id,evaluated_at desc);

alter table public.director_project_final_qc_evidence enable row level security;
alter table public.director_project_final_qc_receipts enable row level security;
revoke all on public.director_project_final_qc_evidence from public,anon,authenticated;
revoke all on public.director_project_final_qc_receipts from public,anon,authenticated;
grant select,insert,update on public.director_project_final_qc_evidence to service_role;
grant select,insert on public.director_project_final_qc_receipts to service_role;

drop policy if exists director_project_final_qc_evidence_service_role_only on public.director_project_final_qc_evidence;
create policy director_project_final_qc_evidence_service_role_only
  on public.director_project_final_qc_evidence
  as restrictive for all to service_role using (true) with check (true);

drop policy if exists director_project_final_qc_receipts_service_role_only on public.director_project_final_qc_receipts;
create policy director_project_final_qc_receipts_service_role_only
  on public.director_project_final_qc_receipts
  as restrictive for all to service_role using (true) with check (true);

comment on table public.director_project_final_qc_evidence is
'Structured normal-project final-watch/coherence/audio/editability evidence. Provider success alone is insufficient.';
