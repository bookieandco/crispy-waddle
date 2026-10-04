-- Provider-neutral visual annotation/review queue (CVAT first adapter).
-- Imported annotations are candidate evidence only until explicitly accepted by Director governance.

create table if not exists public.director_visual_annotation_tasks (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  scope text not null check (scope in ('director','sports','watch')),
  project_id text,
  event_id text,
  asset_id text,
  source_uri text not null,
  source_digest text not null,
  title text not null,
  provider text not null,
  provider_task_id text,
  provider_request_id text,
  status text not null check (status in ('queued','submitted','annotating','review-ready','completed','failed','imported')),
  labels jsonb not null,
  timebase jsonb not null,
  rights_verified boolean not null,
  source_authorized boolean not null,
  evidence_refs text[] not null default '{}',
  imported_digest text,
  imported_annotation_count integer not null default 0,
  web_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (jsonb_typeof(labels)='array'),
  check (jsonb_typeof(timebase)='object')
);

create index if not exists director_visual_annotation_tasks_owner_idx
  on public.director_visual_annotation_tasks(owner_user_id,updated_at desc);
create index if not exists director_visual_annotation_tasks_status_idx
  on public.director_visual_annotation_tasks(status,updated_at)
  where status in ('queued','submitted','annotating','review-ready');

alter table public.director_visual_annotation_tasks enable row level security;
revoke all on public.director_visual_annotation_tasks from public,anon,authenticated;
grant select,insert,update on public.director_visual_annotation_tasks to service_role;

drop policy if exists director_visual_annotation_tasks_service_role_only
  on public.director_visual_annotation_tasks;
create policy director_visual_annotation_tasks_service_role_only
  on public.director_visual_annotation_tasks
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_visual_annotation_tasks is
'External annotation/review tasks such as self-hosted CVAT. Provider output remains GROUND_TRUTH_CANDIDATE_ONLY until separately accepted.';
