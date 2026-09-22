create table if not exists public.director_project_memberships (
  project_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists director_project_memberships_user_idx
  on public.director_project_memberships (user_id, project_id);

alter table public.director_project_memberships enable row level security;
revoke all on public.director_project_memberships from public, anon, authenticated;
grant select, insert, update, delete on public.director_project_memberships to service_role;

drop policy if exists director_project_memberships_service_role_only
  on public.director_project_memberships;
create policy director_project_memberships_service_role_only
  on public.director_project_memberships
  as restrictive
  for all
  to service_role
  using (true)
  with check (true);

alter table public.director_generated_editing_assets
  add column if not exists approval_policy text not null default 'standard';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'director_generated_editing_assets_approval_policy_check'
      and conrelid = 'public.director_generated_editing_assets'::regclass
  ) then
    alter table public.director_generated_editing_assets
      add constraint director_generated_editing_assets_approval_policy_check
      check (approval_policy in ('standard','studio_qc'));
  end if;
end
$$;

create table if not exists public.director_studio_qc_reports (
  id text primary key,
  project_id text not null,
  asset_id text not null references public.director_generated_editing_assets(id) on delete restrict,
  provider text not null,
  minimum_observed_score numeric not null check (minimum_observed_score >= 0 and minimum_observed_score <= 1),
  evidence_ids text[] not null default '{}',
  passed boolean not null,
  action_request_id text,
  created_at timestamptz not null default now()
);

create index if not exists director_studio_qc_reports_asset_idx
  on public.director_studio_qc_reports (project_id, asset_id, created_at desc);

alter table public.director_studio_qc_reports enable row level security;
revoke all on public.director_studio_qc_reports from public, anon, authenticated;
grant select, insert on public.director_studio_qc_reports to service_role;

drop policy if exists director_studio_qc_reports_service_role_only
  on public.director_studio_qc_reports;
create policy director_studio_qc_reports_service_role_only
  on public.director_studio_qc_reports
  as restrictive
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.assert_director_studio_qc_report()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  asset_project_id text;
  asset_policy text;
begin
  select project_id, approval_policy
    into asset_project_id, asset_policy
  from public.director_generated_editing_assets
  where id = new.asset_id;

  if asset_project_id is null then
    raise exception 'Director Studio QC asset does not exist';
  end if;
  if asset_project_id <> new.project_id then
    raise exception 'Director Studio QC project mismatch';
  end if;
  if asset_policy <> 'studio_qc' then
    raise exception 'Director Studio QC report requires studio_qc asset policy';
  end if;
  if not new.passed then
    raise exception 'Failed Director Studio QC reports cannot authorize approval';
  end if;

  return new;
end;
$$;

drop trigger if exists director_studio_qc_report_guard
  on public.director_studio_qc_reports;
create trigger director_studio_qc_report_guard
before insert on public.director_studio_qc_reports
for each row execute function public.assert_director_studio_qc_report();

create or replace function public.reject_director_studio_qc_report_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Director Studio QC reports are append-only';
end;
$$;

drop trigger if exists director_studio_qc_reports_immutable
  on public.director_studio_qc_reports;
create trigger director_studio_qc_reports_immutable
before update or delete on public.director_studio_qc_reports
for each row execute function public.reject_director_studio_qc_report_mutation();

alter table public.director_editing_asset_approvals
  add column if not exists approved_by_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists qc_report_id text references public.director_studio_qc_reports(id) on delete restrict,
  add column if not exists qc_min_score numeric,
  add column if not exists qc_evidence_ids text[] not null default '{}';

create or replace function public.assert_director_editing_asset_approval()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  asset_project_id text;
  asset_policy text;
  membership_role text;
  report_row public.director_studio_qc_reports%rowtype;
begin
  select project_id, approval_policy
    into asset_project_id, asset_policy
  from public.director_generated_editing_assets
  where id = new.asset_id;

  if asset_project_id is null then
    raise exception 'Director editing asset does not exist';
  end if;
  if new.approved_by_user_id is null then
    raise exception 'Director editing approval requires an authenticated approver';
  end if;

  select role into membership_role
  from public.director_project_memberships
  where project_id = asset_project_id
    and user_id = new.approved_by_user_id;

  if membership_role is null or membership_role not in ('owner','editor') then
    raise exception 'Director project edit authority required';
  end if;

  if new.approval_id <> ('approval:' || new.asset_id || ':' || new.approved_by_user_id::text) then
    raise exception 'Director editing approval identity mismatch';
  end if;

  if asset_policy = 'studio_qc' then
    if new.qc_report_id is null then
      raise exception 'Director Studio QC report required before approval';
    end if;

    select * into report_row
    from public.director_studio_qc_reports
    where id = new.qc_report_id
      and project_id = asset_project_id
      and asset_id = new.asset_id
      and passed = true;

    if not found then
      raise exception 'Director Studio QC report does not authorize this asset';
    end if;
    if new.qc_min_score is distinct from report_row.minimum_observed_score then
      raise exception 'Director Studio QC score mismatch';
    end if;
    if new.qc_evidence_ids is distinct from report_row.evidence_ids then
      raise exception 'Director Studio QC evidence mismatch';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists director_editing_asset_approval_guard
  on public.director_editing_asset_approvals;
create trigger director_editing_asset_approval_guard
before insert or update on public.director_editing_asset_approvals
for each row execute function public.assert_director_editing_asset_approval();
