-- Evidence-backed multimodal take selection.
-- Candidate generation and selection are distinct. Missing QC evidence never self-approves a take.

create table if not exists public.director_take_qc_evidence (
  id text primary key,
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  take_group_id text not null,
  take_id text not null,
  generation_task_id text not null,
  asset_id text not null references public.director_generated_editing_assets(id) on delete restrict,
  dimension text not null check (dimension in (
    'continuity','technical','visual-readability','performance','dialogue','story-function',
    'motion','lip-sync','source-relevance','rights-confidence'
  )),
  score numeric not null check (score >= 0 and score <= 1),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  evidence_ids text[] not null,
  notes text[] not null default '{}',
  hard_failures text[] not null default '{}',
  observation_ids text[] not null default '{}',
  source text not null,
  created_at timestamptz not null default now(),
  unique(project_id,take_id,dimension,source)
);

create index if not exists director_take_qc_group_idx
  on public.director_take_qc_evidence(project_id,take_group_id,take_id,created_at);

create table if not exists public.director_take_selections (
  id text primary key,
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  take_group_id text not null,
  policy_id text not null,
  selected_take_id text,
  selected_asset_id text,
  alternate_take_ids text[] not null default '{}',
  ranked jsonb not null,
  status text not null check (status in ('selected','blocked')),
  evidence_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,take_group_id)
);

create index if not exists director_take_selections_project_idx
  on public.director_take_selections(project_id,updated_at desc);

alter table public.director_take_qc_evidence enable row level security;
alter table public.director_take_selections enable row level security;
revoke all on public.director_take_qc_evidence from public,anon,authenticated;
revoke all on public.director_take_selections from public,anon,authenticated;
grant select,insert,update on public.director_take_qc_evidence to service_role;
grant select,insert,update on public.director_take_selections to service_role;

drop policy if exists director_take_qc_evidence_service_role_only on public.director_take_qc_evidence;
create policy director_take_qc_evidence_service_role_only
  on public.director_take_qc_evidence
  as restrictive for all to service_role using (true) with check (true);

drop policy if exists director_take_selections_service_role_only on public.director_take_selections;
create policy director_take_selections_service_role_only
  on public.director_take_selections
  as restrictive for all to service_role using (true) with check (true);

comment on table public.director_take_selections is
'Evidence-backed Director take selection receipts. Alternatives are preserved; selection grants no publication authority.';
