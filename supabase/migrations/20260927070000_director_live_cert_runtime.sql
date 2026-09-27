-- Runtime-only Director endpoint/credential registry and live certification receipts.
-- Values are service-role-only. No anon/authenticated access is admitted.

create table if not exists public.director_runtime_config (
  key text primary key,
  value text not null,
  sensitive boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.director_runtime_config enable row level security;
revoke all on public.director_runtime_config from anon, authenticated;
grant select, insert, update, delete on public.director_runtime_config to service_role;

create policy director_runtime_config_service_role_only
  on public.director_runtime_config
  as restrictive for all
  to service_role
  using (true)
  with check (true);

comment on table public.director_runtime_config is
'Service-role-only Director runtime endpoints and opaque worker/provider credentials. Never expose through client APIs.';

create table if not exists public.director_live_certification_runs (
  id text primary key,
  source_url text not null,
  status text not null check (status in ('queued','studying','recipe_ready','rendering','verifying','completed','failed')),
  replication_job_id text,
  video_job_ids jsonb not null default '[]'::jsonb,
  artifact_ids jsonb not null default '[]'::jsonb,
  requested_durations jsonb not null default '[]'::jsonb,
  measured_durations jsonb not null default '{}'::jsonb,
  receipts jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.director_live_certification_runs enable row level security;
revoke all on public.director_live_certification_runs from anon, authenticated;
grant select, insert, update, delete on public.director_live_certification_runs to service_role;

create policy director_live_certification_runs_service_role_only
  on public.director_live_certification_runs
  as restrictive for all
  to service_role
  using (true)
  with check (true);

comment on table public.director_live_certification_runs is
'Live runtime certification receipts for DIRECTOR-REPLICATE.FINAL. Smoke artifacts certify orchestration/runtime only, not cinematic quality.';


create table if not exists public.director_live_certification_tokens (
  token_hash text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.director_live_certification_tokens enable row level security;
revoke all on public.director_live_certification_tokens from anon, authenticated;
grant select, insert, update, delete on public.director_live_certification_tokens to service_role;

create policy director_live_certification_tokens_service_role_only
  on public.director_live_certification_tokens
  as restrictive for all
  to service_role
  using (true)
  with check (true);

comment on table public.director_live_certification_tokens is
'Single-use short-lived machine tokens for DIRECTOR-REPLICATE live certification. Store hashes only; never persist plaintext tokens.';
