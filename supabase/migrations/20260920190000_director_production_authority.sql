-- DIR-10 canonical production authority. Server/service-role only.
create table if not exists public.director_production_runs (
  id text primary key,
  project_id text not null,
  status text not null check (status in ('draft','planning','awaiting_approval','executing','review','completed','failed','cancelled')),
  shot_ids text[] not null default '{}',
  gate_ids text[] not null default '{}',
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.director_creative_gates (
  id text primary key,
  project_id text not null,
  run_id text not null references public.director_production_runs(id) on delete restrict,
  kind text not null check (kind in ('storyboard','shotlist','generation','rough_cut','final')),
  decision text not null check (decision in ('pending','approved','changes_requested','rejected')),
  requested_at timestamptz not null,
  decided_at timestamptz,
  note text,
  evidence_ids text[] not null default '{}',
  decided_by text,
  version bigint not null default 1 check (version > 0),
  unique (project_id, run_id, id)
);
create table if not exists public.director_creative_stages (
  id text primary key,
  project_id text not null,
  kind text not null check (kind in ('vision','treatment','storyboard','shotlist','previs','generation','edit','review','final')),
  depends_on text[] not null default '{}',
  status text not null check (status in ('planned','ready','running','review','approved','stale','failed')),
  input_artifact_ids text[] not null default '{}',
  output_artifact_ids text[] not null default '{}',
  version bigint not null default 1 check (version > 0),
  approved_at timestamptz,
  approved_by text,
  last_invalidation jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists director_runs_project_idx on public.director_production_runs(project_id,id);
create index if not exists director_gates_project_run_idx on public.director_creative_gates(project_id,run_id,id);
create index if not exists director_stages_project_idx on public.director_creative_stages(project_id,id);
alter table public.director_production_runs enable row level security;
alter table public.director_creative_gates enable row level security;
alter table public.director_creative_stages enable row level security;
revoke all on public.director_production_runs from anon, authenticated;
revoke all on public.director_creative_gates from anon, authenticated;
revoke all on public.director_creative_stages from anon, authenticated;
grant select, insert, update on public.director_production_runs to service_role;
grant select, insert, update on public.director_creative_gates to service_role;
grant select, insert, update on public.director_creative_stages to service_role;
