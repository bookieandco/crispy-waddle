-- Optional visual-annotation / ground-truth provider bridge (CVAT-compatible).
-- Provider state is evidence only. Acceptance into Jhadina truth is explicit.

create table if not exists public.director_visual_annotation_tasks (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  scope text not null check (scope in ('director','sports','watch')),
  project_id text,
  event_id text,
  asset_id text,
  title text not null,
  source_uri text not null,
  provider text not null,
  provider_task_id text,
  provider_request_id text,
  provider_web_url text,
  provider_status text not null default 'planned'
    check (provider_status in ('planned','submitted','annotating','review-ready','completed','failed')),
  label_schema jsonb not null default '[]'::jsonb,
  timebase jsonb not null,
  rights_verified boolean not null default false,
  source_authorized boolean not null default false,
  evidence_refs text[] not null default '{}',
  provider_state jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (scope='director' and project_id is not null and asset_id is not null)
    or (scope='sports' and event_id is not null)
    or scope='watch'
  )
);

create index if not exists director_visual_annotation_tasks_owner_idx
  on public.director_visual_annotation_tasks(owner_user_id,updated_at desc);
create index if not exists director_visual_annotation_tasks_project_idx
  on public.director_visual_annotation_tasks(project_id,updated_at desc)
  where project_id is not null;
create index if not exists director_visual_annotation_tasks_event_idx
  on public.director_visual_annotation_tasks(event_id,updated_at desc)
  where event_id is not null;

create table if not exists public.director_visual_annotation_imports (
  id text primary key,
  annotation_task_id text not null references public.director_visual_annotation_tasks(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  provider text not null,
  provider_task_id text not null,
  source_digest text not null,
  imported_at timestamptz not null,
  shape_count integer not null default 0 check (shape_count >= 0),
  candidate_evidence_ids text[] not null default '{}',
  raw_summary jsonb not null default '{}'::jsonb,
  review_status text not null default 'pending'
    check (review_status in ('pending','accepted','rejected')),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete restrict,
  review_note text,
  created_at timestamptz not null default now(),
  unique(annotation_task_id,source_digest)
);

create index if not exists director_visual_annotation_imports_task_idx
  on public.director_visual_annotation_imports(annotation_task_id,imported_at desc);

create table if not exists public.director_visual_annotation_evidence (
  id text primary key,
  annotation_import_id text not null references public.director_visual_annotation_imports(id) on delete cascade,
  annotation_task_id text not null references public.director_visual_annotation_tasks(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  project_id text,
  event_id text,
  asset_id text,
  provider text not null,
  annotation_kind text not null
    check (annotation_kind in ('box','polygon','mask','keypoints','track','tag')),
  frame_start integer not null check (frame_start >= 0),
  frame_end integer not null check (frame_end >= frame_start),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  evidence_refs text[] not null default '{}',
  limitations text[] not null default '{}',
  protected_regions jsonb not null default '[]'::jsonb,
  raw_annotation_ids text[] not null default '{}',
  accepted boolean not null default false,
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists director_visual_annotation_evidence_project_idx
  on public.director_visual_annotation_evidence(project_id,accepted,frame_start,frame_end)
  where project_id is not null;
create index if not exists director_visual_annotation_evidence_event_idx
  on public.director_visual_annotation_evidence(event_id,accepted,frame_start,frame_end)
  where event_id is not null;

alter table public.director_visual_annotation_tasks enable row level security;
alter table public.director_visual_annotation_imports enable row level security;
alter table public.director_visual_annotation_evidence enable row level security;

revoke all on public.director_visual_annotation_tasks from public,anon,authenticated;
revoke all on public.director_visual_annotation_imports from public,anon,authenticated;
revoke all on public.director_visual_annotation_evidence from public,anon,authenticated;

grant select,insert,update on public.director_visual_annotation_tasks to service_role;
grant select,insert,update on public.director_visual_annotation_imports to service_role;
grant select,insert,update on public.director_visual_annotation_evidence to service_role;

drop policy if exists director_visual_annotation_tasks_service_role_only on public.director_visual_annotation_tasks;
create policy director_visual_annotation_tasks_service_role_only
  on public.director_visual_annotation_tasks
  as restrictive for all to service_role using (true) with check (true);

drop policy if exists director_visual_annotation_imports_service_role_only on public.director_visual_annotation_imports;
create policy director_visual_annotation_imports_service_role_only
  on public.director_visual_annotation_imports
  as restrictive for all to service_role using (true) with check (true);

drop policy if exists director_visual_annotation_evidence_service_role_only on public.director_visual_annotation_evidence;
create policy director_visual_annotation_evidence_service_role_only
  on public.director_visual_annotation_evidence
  as restrictive for all to service_role using (true) with check (true);

comment on table public.director_visual_annotation_tasks is
'Provider-neutral visual annotation tasks. CVAT is optional evidence/review infrastructure and never Director state authority.';
comment on table public.director_visual_annotation_imports is
'Immutable-ish import snapshots from annotation providers. Explicit review is required before evidence becomes accepted.';
comment on table public.director_visual_annotation_evidence is
'Normalized Director visual evidence candidates derived from provider annotations. accepted=false is never edit authority.';
