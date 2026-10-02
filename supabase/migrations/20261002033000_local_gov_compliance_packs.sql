-- LOCAL-GOV.6 — state compliance evidence gates for public work packages and provider shortlists.

alter table public.jhadina_public_work_packages
  add column if not exists compliance_pack_id text,
  add column if not exists compliance_status text not null default 'review_required',
  add column if not exists compliance_requirements jsonb not null default '[]'::jsonb,
  add column if not exists compliance_required_evidence_ids text[] not null default array[]::text[],
  add column if not exists compliance_blockers text[] not null default array[]::text[],
  add column if not exists compliance_evidence_refs text[] not null default array[]::text[],
  add column if not exists compliance_assessed_at timestamptz;

alter table public.jhadina_public_work_packages
  drop constraint if exists jhadina_public_work_packages_compliance_status_check;
alter table public.jhadina_public_work_packages
  add constraint jhadina_public_work_packages_compliance_status_check
  check (compliance_status in ('evidence_complete','review_required','blocked'));

alter table public.jhadina_public_package_provider_candidates
  add column if not exists compliance_status text not null default 'review_required',
  add column if not exists compliance_required_evidence_ids text[] not null default array[]::text[],
  add column if not exists compliance_matched_evidence_ids text[] not null default array[]::text[],
  add column if not exists compliance_missing_evidence_ids text[] not null default array[]::text[],
  add column if not exists compliance_reasons text[] not null default array[]::text[];

alter table public.jhadina_public_package_provider_candidates
  drop constraint if exists jhadina_public_package_provider_candidates_compliance_status_check;
alter table public.jhadina_public_package_provider_candidates
  add constraint jhadina_public_package_provider_candidates_compliance_status_check
  check (compliance_status in ('evidence_complete','review_required','blocked'));

create index if not exists jhadina_public_work_packages_compliance_idx
  on public.jhadina_public_work_packages (compliance_status, status, updated_at);

create index if not exists jhadina_public_package_provider_candidates_compliance_idx
  on public.jhadina_public_package_provider_candidates (package_id, compliance_status, score desc);

revoke all on table public.jhadina_public_work_packages from anon, authenticated;
revoke all on table public.jhadina_public_package_provider_candidates from anon, authenticated;
grant all on table public.jhadina_public_work_packages to service_role;
grant all on table public.jhadina_public_package_provider_candidates to service_role;
