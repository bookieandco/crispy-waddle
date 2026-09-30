-- MUSIC-RESTORE.5 instrument reconstruction provenance.

alter table public.music_restoration_jobs
  drop constraint if exists music_restoration_jobs_kind_check;
alter table public.music_restoration_jobs
  add constraint music_restoration_jobs_kind_check
  check (kind in ('probe','separate','perceive','repair','reconstruct'));

create table if not exists public.music_restoration_reconstruction_receipts (
  id text primary key,
  job_id text not null unique references public.music_restoration_jobs(id) on delete restrict,
  case_id text not null references public.music_restoration_cases(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_artifact_id text not null references public.music_restoration_artifacts(id) on delete restrict,
  replacement_artifact_id text not null references public.music_restoration_artifacts(id) on delete restrict,
  output_artifact_id text not null references public.music_restoration_artifacts(id) on delete restrict,
  instrument_family text not null,
  segments jsonb not null,
  fingerprint_similarity numeric not null check (fingerprint_similarity >= 0 and fingerprint_similarity <= 1),
  expected_gain numeric not null check (expected_gain >= 0 and expected_gain <= 1),
  gain_confidence numeric not null check (gain_confidence >= 0 and gain_confidence <= 1),
  gain_evidence_method text not null,
  evidence_ids text[] not null default '{}',
  approval_evidence_id text not null,
  approved_by_user_id uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null,
  runtime_receipt_id text not null,
  qc jsonb not null,
  created_at timestamptz not null default now(),
  check (source_artifact_id <> replacement_artifact_id)
);

create index if not exists music_restoration_reconstruction_case_idx
  on public.music_restoration_reconstruction_receipts(case_id,created_at);
create index if not exists music_restoration_reconstruction_owner_idx
  on public.music_restoration_reconstruction_receipts(owner_user_id);
create index if not exists music_restoration_reconstruction_source_idx
  on public.music_restoration_reconstruction_receipts(source_artifact_id);
create index if not exists music_restoration_reconstruction_replacement_idx
  on public.music_restoration_reconstruction_receipts(replacement_artifact_id);
create index if not exists music_restoration_reconstruction_output_idx
  on public.music_restoration_reconstruction_receipts(output_artifact_id);
create index if not exists music_restoration_reconstruction_approver_idx
  on public.music_restoration_reconstruction_receipts(approved_by_user_id);

alter table public.music_restoration_reconstruction_receipts enable row level security;
alter table public.music_restoration_reconstruction_receipts force row level security;

revoke all on public.music_restoration_reconstruction_receipts from public,anon,authenticated,service_role;
grant select,insert on public.music_restoration_reconstruction_receipts to service_role;

drop policy if exists music_restoration_reconstruction_service_role_only
  on public.music_restoration_reconstruction_receipts;
create policy music_restoration_reconstruction_service_role_only
  on public.music_restoration_reconstruction_receipts
  as restrictive for all to service_role
  using(true) with check(true);
