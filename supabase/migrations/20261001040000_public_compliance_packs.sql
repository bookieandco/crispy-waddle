-- LOCAL-GOV.6 — state compliance pack registry and evidence assessments.

create table if not exists public.jhadina_public_compliance_packs (
  state_code text primary key,
  version text not null,
  status text not null check (status in ('verified_reference','discovery_required','disabled')),
  pack jsonb not null default '{}'::jsonb,
  source_refs text[] not null default array[]::text[],
  source_observed_on date,
  updated_at timestamptz not null default now()
);

insert into public.jhadina_public_compliance_packs (state_code,version,status)
values
  ('AL','al-discovery-required.v1','discovery_required'),
  ('AK','ak-discovery-required.v1','discovery_required'),
  ('AZ','az-discovery-required.v1','discovery_required'),
  ('AR','ar-discovery-required.v1','discovery_required'),
  ('CA','ca-public-works-2026-09-30.v1','verified_reference'),
  ('CO','co-discovery-required.v1','discovery_required'),
  ('CT','ct-discovery-required.v1','discovery_required'),
  ('DE','de-discovery-required.v1','discovery_required'),
  ('FL','fl-discovery-required.v1','discovery_required'),
  ('GA','ga-discovery-required.v1','discovery_required'),
  ('HI','hi-discovery-required.v1','discovery_required'),
  ('ID','id-discovery-required.v1','discovery_required'),
  ('IL','il-discovery-required.v1','discovery_required'),
  ('IN','in-discovery-required.v1','discovery_required'),
  ('IA','ia-discovery-required.v1','discovery_required'),
  ('KS','ks-discovery-required.v1','discovery_required'),
  ('KY','ky-discovery-required.v1','discovery_required'),
  ('LA','la-discovery-required.v1','discovery_required'),
  ('ME','me-discovery-required.v1','discovery_required'),
  ('MD','md-discovery-required.v1','discovery_required'),
  ('MA','ma-discovery-required.v1','discovery_required'),
  ('MI','mi-discovery-required.v1','discovery_required'),
  ('MN','mn-discovery-required.v1','discovery_required'),
  ('MS','ms-discovery-required.v1','discovery_required'),
  ('MO','mo-discovery-required.v1','discovery_required'),
  ('MT','mt-discovery-required.v1','discovery_required'),
  ('NE','ne-discovery-required.v1','discovery_required'),
  ('NV','nv-discovery-required.v1','discovery_required'),
  ('NH','nh-discovery-required.v1','discovery_required'),
  ('NJ','nj-discovery-required.v1','discovery_required'),
  ('NM','nm-discovery-required.v1','discovery_required'),
  ('NY','ny-discovery-required.v1','discovery_required'),
  ('NC','nc-discovery-required.v1','discovery_required'),
  ('ND','nd-discovery-required.v1','discovery_required'),
  ('OH','oh-discovery-required.v1','discovery_required'),
  ('OK','ok-discovery-required.v1','discovery_required'),
  ('OR','or-discovery-required.v1','discovery_required'),
  ('PA','pa-discovery-required.v1','discovery_required'),
  ('RI','ri-discovery-required.v1','discovery_required'),
  ('SC','sc-discovery-required.v1','discovery_required'),
  ('SD','sd-discovery-required.v1','discovery_required'),
  ('TN','tn-discovery-required.v1','discovery_required'),
  ('TX','tx-discovery-required.v1','discovery_required'),
  ('UT','ut-discovery-required.v1','discovery_required'),
  ('VT','vt-discovery-required.v1','discovery_required'),
  ('VA','va-discovery-required.v1','discovery_required'),
  ('WA','wa-discovery-required.v1','discovery_required'),
  ('WV','wv-discovery-required.v1','discovery_required'),
  ('WI','wi-discovery-required.v1','discovery_required'),
  ('WY','wy-discovery-required.v1','discovery_required'),
  ('DC','dc-discovery-required.v1','discovery_required')
on conflict (state_code) do nothing;

create table if not exists public.jhadina_public_compliance_evidence (
  id text primary key,
  subject_type text not null check (subject_type in ('work_package','package_provider')),
  subject_id text not null,
  state_code text not null,
  kind text not null,
  status text not null check (status in ('verified','unverified','missing','expired','failed')),
  value jsonb,
  source_url text,
  evidence_ref text,
  observed_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_public_compliance_evidence_subject_idx
  on public.jhadina_public_compliance_evidence (subject_type,subject_id,state_code,kind,status);

create table if not exists public.jhadina_public_work_package_compliance (
  package_id text primary key references public.jhadina_public_work_packages(id) on delete cascade,
  state_code text not null,
  pack_version text not null,
  status text not null check (status in ('pass','review_required','blocked')),
  gate_results jsonb not null default '[]'::jsonb,
  blockers text[] not null default array[]::text[],
  conditions text[] not null default array[]::text[],
  evidence_refs text[] not null default array[]::text[],
  assessed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_public_compliance_source_jobs (
  state_code text primary key references public.jhadina_public_compliance_packs(state_code) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','sources_discovered','pack_review_required','verified','blocked')),
  target_topics text[] not null default array[
    'contractor_license','public_works_registration','prevailing_wage','apprenticeship',
    'certified_payroll','workers_comp','debarment','bonding'
  ]::text[],
  source_refs text[] not null default array[]::text[],
  last_attempt_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  updated_at timestamptz not null default now()
);

insert into public.jhadina_public_compliance_source_jobs (state_code,status,source_refs)
select state_code,
       case when state_code='CA' then 'verified' else 'pending' end,
       case when state_code='CA' then array[
         'https://www.dir.ca.gov/Public-Works/Contractor-Registration.html',
         'https://www.dir.ca.gov/public-works/contractors.html',
         'https://www.dir.ca.gov/Public-Works/',
         'https://www.dir.ca.gov/public-works/prevailing-wage.html',
         'https://www.cslb.ca.gov/Contractors/Applicants/Contractors_License/Exam_Application/Before_Applying_For_License.aspx'
       ]::text[] else array[]::text[] end
from public.jhadina_public_compliance_packs
on conflict (state_code) do nothing;

alter table public.jhadina_public_compliance_packs enable row level security;
alter table public.jhadina_public_compliance_evidence enable row level security;
alter table public.jhadina_public_work_package_compliance enable row level security;
alter table public.jhadina_public_compliance_source_jobs enable row level security;

revoke all on table public.jhadina_public_compliance_packs from anon, authenticated;
revoke all on table public.jhadina_public_compliance_evidence from anon, authenticated;
revoke all on table public.jhadina_public_work_package_compliance from anon, authenticated;
revoke all on table public.jhadina_public_compliance_source_jobs from anon, authenticated;

grant all on table public.jhadina_public_compliance_packs to service_role;
grant all on table public.jhadina_public_compliance_evidence to service_role;
grant all on table public.jhadina_public_work_package_compliance to service_role;
grant all on table public.jhadina_public_compliance_source_jobs to service_role;
