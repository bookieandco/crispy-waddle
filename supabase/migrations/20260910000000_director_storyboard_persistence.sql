-- Canonical Director storyboard persistence.
--
-- These tables are intentionally service-role only. They are a persistence
-- boundary, not a client-facing CRUD surface. Canonical storyboard mutation
-- must occur through a governed application path that records a new version;
-- callers must never be able to rewrite a committed storyboard through direct
-- PostgREST UPDATE/DELETE access.

create table if not exists public.director_storyboard_sequences (
  id text primary key,
  project_id text not null,
  scene_id text not null,
  board_ids text[] not null default '{}',
  version integer not null check (version > 0),
  updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint director_storyboard_sequences_project_scene_unique unique (project_id, id)
);

create table if not exists public.director_storyboard_boards (
  id text primary key,
  sequence_id text not null references public.director_storyboard_sequences(id) on delete restrict,
  project_id text not null,
  shot_id text not null,
  ordinal integer not null check (ordinal >= 0),
  status text not null check (status in ('draft', 'ready', 'approved', 'stale', 'rejected')),
  title text,
  description text,
  script_ref text,
  reference_asset_ids text[] not null default '{}',
  continuity_anchor_ids text[] not null default '{}',
  continuity_locks jsonb,
  camera_language text,
  framing text,
  action text,
  notes text,
  cinematography jsonb,
  version integer not null check (version > 0),
  artifact_ids text[] not null default '{}',
  updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint director_storyboard_boards_project_id_unique unique (project_id, id)
);

-- Keep the project boundary database-enforced as well as application-enforced.
-- A board may only point at a sequence from the same project.
create or replace function public.assert_director_storyboard_board_project()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  sequence_project_id text;
begin
  select project_id into sequence_project_id
    from public.director_storyboard_sequences
    where id = new.sequence_id;

  if sequence_project_id is null then
    raise exception 'Storyboard sequence does not exist: %', new.sequence_id;
  end if;

  if sequence_project_id <> new.project_id then
    raise exception 'Storyboard board/sequence project mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists director_storyboard_board_project_guard on public.director_storyboard_boards;
create trigger director_storyboard_board_project_guard
before insert or update on public.director_storyboard_boards
for each row execute function public.assert_director_storyboard_board_project();

-- Version history is append-only. These rows are evidence of the canonical
-- state used by downstream provenance and must not be editable or deletable.
create table if not exists public.director_storyboard_sequence_versions (
  sequence_id text not null,
  version integer not null check (version > 0),
  project_id text not null,
  scene_id text not null,
  board_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (sequence_id, version),
  foreign key (sequence_id) references public.director_storyboard_sequences(id) on delete restrict
);

create table if not exists public.director_storyboard_board_versions (
  board_id text not null,
  version integer not null check (version > 0),
  sequence_id text not null,
  project_id text not null,
  shot_id text not null,
  ordinal integer not null check (ordinal >= 0),
  status text not null check (status in ('draft', 'ready', 'approved', 'stale', 'rejected')),
  title text,
  description text,
  script_ref text,
  reference_asset_ids text[] not null default '{}',
  continuity_anchor_ids text[] not null default '{}',
  continuity_locks jsonb,
  camera_language text,
  framing text,
  action text,
  notes text,
  cinematography jsonb,
  artifact_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (board_id, version),
  foreign key (board_id) references public.director_storyboard_boards(id) on delete restrict
);

create table if not exists public.director_storyboard_stage_bindings (
  id text primary key,
  project_id text not null,
  storyboard_board_id text not null references public.director_storyboard_boards(id) on delete restrict,
  storyboard_stage_id text not null,
  shotlist_stage_id text not null,
  previs_stage_id text,
  generation_stage_id text,
  edit_stage_id text,
  review_stage_id text,
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  constraint director_storyboard_stage_bindings_project_id_unique unique (project_id, id)
);

create or replace function public.assert_director_storyboard_binding_project()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  board_project_id text;
begin
  select project_id into board_project_id
    from public.director_storyboard_boards
    where id = new.storyboard_board_id;

  if board_project_id is null then
    raise exception 'Storyboard board does not exist: %', new.storyboard_board_id;
  end if;

  if board_project_id <> new.project_id then
    raise exception 'Storyboard binding/board project mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists director_storyboard_binding_project_guard on public.director_storyboard_stage_bindings;
create trigger director_storyboard_binding_project_guard
before insert or update on public.director_storyboard_stage_bindings
for each row execute function public.assert_director_storyboard_binding_project();

-- Append-only evidence tables cannot be rewritten or erased, even by an
-- authenticated client. The application service role may insert new evidence
-- through the governed persistence path.
create or replace function public.reject_director_storyboard_history_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Director storyboard version history is append-only';
end;
$$;

drop trigger if exists director_storyboard_sequence_versions_immutable on public.director_storyboard_sequence_versions;
create trigger director_storyboard_sequence_versions_immutable
before update or delete on public.director_storyboard_sequence_versions
for each row execute function public.reject_director_storyboard_history_mutation();

drop trigger if exists director_storyboard_board_versions_immutable on public.director_storyboard_board_versions;
create trigger director_storyboard_board_versions_immutable
before update or delete on public.director_storyboard_board_versions
for each row execute function public.reject_director_storyboard_history_mutation();

-- Client roles have no direct access. This prevents an untrusted caller from
-- manufacturing or rewriting canonical storyboard lineage.
alter table public.director_storyboard_sequences enable row level security;
alter table public.director_storyboard_boards enable row level security;
alter table public.director_storyboard_sequence_versions enable row level security;
alter table public.director_storyboard_board_versions enable row level security;
alter table public.director_storyboard_stage_bindings enable row level security;

revoke all on public.director_storyboard_sequences from public, anon, authenticated;
revoke all on public.director_storyboard_boards from public, anon, authenticated;
revoke all on public.director_storyboard_sequence_versions from public, anon, authenticated;
revoke all on public.director_storyboard_board_versions from public, anon, authenticated;
revoke all on public.director_storyboard_stage_bindings from public, anon, authenticated;

grant select, insert, update, delete on public.director_storyboard_sequences to service_role;
grant select, insert, update, delete on public.director_storyboard_boards to service_role;
grant select, insert on public.director_storyboard_sequence_versions to service_role;
grant select, insert on public.director_storyboard_board_versions to service_role;
grant select, insert, update, delete on public.director_storyboard_stage_bindings to service_role;

grant usage on schema public to service_role;

comment on table public.director_storyboard_sequences is 'Canonical Director storyboard sequences; service-role persistence boundary.';
comment on table public.director_storyboard_boards is 'Canonical Director storyboard boards; service-role persistence boundary.';
comment on table public.director_storyboard_sequence_versions is 'Append-only Director storyboard sequence evidence.';
comment on table public.director_storyboard_board_versions is 'Append-only Director storyboard board evidence.';
comment on table public.director_storyboard_stage_bindings is 'Project-scoped binding from storyboard boards to CreativeStageGraph stage IDs.';
