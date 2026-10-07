-- STAFFING-AUDIT.1
-- Staffing Core owns the canonical tenant boundary. Placement Core may remain
-- as a compatibility facade, but Staffing migrations must not depend on a
-- Placement-owned membership table or an always-true CI stub.

create table if not exists public.staffing_organizations (
  id uuid primary key,
  legal_name text not null,
  display_name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staffing_memberships (
  id text primary key,
  organization_id uuid not null references public.staffing_organizations(id) on delete cascade,
  user_id text not null,
  role text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (organization_id, user_id)
);

create index if not exists staffing_memberships_user_status_idx
  on public.staffing_memberships (user_id, status);
create index if not exists staffing_memberships_org_status_idx
  on public.staffing_memberships (organization_id, status);

create or replace function public.staffing_current_user_id()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_user_id text;
begin
  -- Supabase/PostgREST path when auth.uid() exists.
  begin
    execute 'select auth.uid()::text' into resolved_user_id;
  exception
    when undefined_function or invalid_schema_name then
      resolved_user_id := null;
  end;

  if nullif(resolved_user_id, '') is not null then
    return resolved_user_id;
  end if;

  -- Provider-neutral server/CI fallback. STAFFING-AUDIT.4 must bind this
  -- setting to an authenticated session before production commissioning.
  return nullif(current_setting('app.user_id', true), '');
end;
$$;

create or replace function public.staffing_is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staffing_memberships membership
    where membership.organization_id = target_org
      and membership.user_id = public.staffing_current_user_id()
      and membership.status = 'ACTIVE'
      and membership.revoked_at is null
  );
$$;

-- Temporary compatibility name used by the existing 0005-0022 migrations.
-- It delegates to Staffing Core state; it does not read Placement Core tables.
create or replace function public.placement_is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.staffing_is_org_member(target_org);
$$;

alter table public.staffing_organizations enable row level security;
alter table public.staffing_memberships enable row level security;

drop policy if exists "staffing organizations membership access" on public.staffing_organizations;
create policy "staffing organizations membership access" on public.staffing_organizations
for select using (public.staffing_is_org_member(id));

drop policy if exists "staffing memberships self access" on public.staffing_memberships;
create policy "staffing memberships self access" on public.staffing_memberships
for select using (user_id = public.staffing_current_user_id());

comment on function public.placement_is_org_member(uuid)
is 'Legacy Staffing migration compatibility wrapper. Canonical membership authority is staffing_is_org_member(uuid).';
