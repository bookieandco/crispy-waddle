-- GEV-P5: durable append-only SpatialWorkspace snapshots and replay.
-- Generated during the GEV integration pass. The Supabase CLI is not available
-- in the execution environment, so this migration must still be exercised by
-- the repository's normal migration/CI path before production promotion.

create table if not exists public.jhadina_spatial_workspace_revisions (
  revision_id text primary key,
  workspace_id text not null,
  owner_id text not null,
  captured_at timestamptz not null,
  reason text not null check (length(trim(reason)) > 0),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_spatial_workspace_owner_latest_idx
  on public.jhadina_spatial_workspace_revisions (owner_id, workspace_id, captured_at desc);

alter table public.jhadina_spatial_workspace_revisions enable row level security;

create policy jhadina_spatial_workspace_service_role_only
  on public.jhadina_spatial_workspace_revisions as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_spatial_workspace_revisions from anon, authenticated;
revoke update, delete on public.jhadina_spatial_workspace_revisions from service_role;
grant select, insert on public.jhadina_spatial_workspace_revisions to service_role;

create or replace function public.jhadina_spatial_workspace_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'SPATIAL_WORKSPACE_APPEND_ONLY';
end;
$$;

drop trigger if exists jhadina_spatial_workspace_no_update_delete on public.jhadina_spatial_workspace_revisions;
create trigger jhadina_spatial_workspace_no_update_delete
before update or delete on public.jhadina_spatial_workspace_revisions
for each row execute function public.jhadina_spatial_workspace_append_only();
