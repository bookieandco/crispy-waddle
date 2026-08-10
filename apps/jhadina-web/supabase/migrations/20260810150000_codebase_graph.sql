create table if not exists public.janet_codebase_indexes (
  repository text not null,
  git_ref text not null,
  indexed_at timestamptz not null default now(),
  source_sha text,
  primary key (repository, git_ref)
);

create table if not exists public.janet_codebase_nodes (
  id text primary key,
  repository text not null,
  git_ref text not null,
  kind text not null check (kind in ('file', 'symbol')),
  name text not null,
  path text not null,
  symbol_kind text,
  start_line integer,
  end_line integer,
  indexed_at timestamptz not null default now(),
  foreign key (repository, git_ref)
    references public.janet_codebase_indexes(repository, git_ref)
    on delete cascade
);

create table if not exists public.janet_codebase_edges (
  from_id text not null references public.janet_codebase_nodes(id) on delete cascade,
  to_id text not null references public.janet_codebase_nodes(id) on delete cascade,
  kind text not null check (kind in ('imports', 'exports', 'references')),
  primary key (from_id, to_id, kind)
);

create index if not exists janet_codebase_nodes_repo_ref_path_idx
  on public.janet_codebase_nodes(repository, git_ref, path);

create index if not exists janet_codebase_nodes_repo_ref_name_idx
  on public.janet_codebase_nodes(repository, git_ref, lower(name));

create index if not exists janet_codebase_edges_from_idx
  on public.janet_codebase_edges(from_id);

create index if not exists janet_codebase_edges_to_idx
  on public.janet_codebase_edges(to_id);
