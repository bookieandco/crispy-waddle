-- Director AUTO.5 durable post-production planning.
-- Plans compile narration/dialogue, captions, music, Foley and lip-sync requirements from
-- accepted screenplay + canonical rough cut. Provider execution remains separately admitted.

create table if not exists public.director_audio_post_plans (
  id text primary key,
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  production_run_id text not null,
  plan_id text not null,
  timeline_revision bigint not null check (timeline_revision >= 1),
  format text not null,
  post_plan jsonb not null,
  required_worker_profiles text[] not null default '{}',
  ready_worker_profiles text[] not null default '{}',
  blockers text[] not null default '{}',
  status text not null check (status in (
    'planned','awaiting_workers','executing','review','completed','blocked'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,plan_id,timeline_revision)
);

create index if not exists director_audio_post_plans_project_idx
  on public.director_audio_post_plans(project_id,updated_at desc);

alter table public.director_audio_post_plans enable row level security;
revoke all on public.director_audio_post_plans from public,anon,authenticated;
grant select,insert,update on public.director_audio_post_plans to service_role;

drop policy if exists director_audio_post_plans_service_role_only on public.director_audio_post_plans;
create policy director_audio_post_plans_service_role_only
  on public.director_audio_post_plans
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_audio_post_plans is
'Provider-neutral Director post plan for narration/dialogue, captions, music, Foley/SFX, stems and lip sync. Planning never implies provider execution or final-media approval.';
