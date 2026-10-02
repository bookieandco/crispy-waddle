-- MUSIC-AUTO.1 -> MUSIC-AUTO.13 durable autopilot runtime.
-- This schema records owner-scoped automation charters, run leases and
-- idempotent action receipts. It does not grant publish, spend, contract,
-- rights or venue authority; those remain in their canonical systems.

create table if not exists public.jhadina_music_autopilot_charters (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  enabled boolean not null default false,
  allowed_social_account_ids jsonb not null default '[]'::jsonb,
  max_director_jobs_per_run integer not null default 3 check (max_director_jobs_per_run between 0 and 20),
  max_social_proposals_per_run integer not null default 3 check (max_social_proposals_per_run between 0 and 20),
  max_preapproved_paid_minor_per_run bigint not null default 0 check (max_preapproved_paid_minor_per_run >= 0),
  max_preapproved_paid_minor_per_day bigint not null default 0 check (max_preapproved_paid_minor_per_day >= 0),
  currency text not null default 'USD',
  allow_prepared_assets boolean not null default true,
  allow_approved_content_scheduling boolean not null default true,
  allow_preapproved_paid_tests boolean not null default false,
  pause_on_ambiguous_external_state boolean not null default true,
  paid_authority_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id),
  check (jsonb_typeof(allowed_social_account_ids) = 'array'),
  check (max_preapproved_paid_minor_per_run <= max_preapproved_paid_minor_per_day),
  check (
    allow_preapproved_paid_tests = false
    or (
      max_preapproved_paid_minor_per_run > 0
      and max_preapproved_paid_minor_per_day > 0
      and nullif(trim(paid_authority_ref), '') is not null
    )
  )
);

create table if not exists public.jhadina_music_autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  run_key text not null,
  status text not null check (status in ('queued','running','blocked','completed','failed')),
  mode text not null check (mode in ('SEARCH','ATTACK')),
  current_stage text,
  stage_receipts jsonb not null default '[]'::jsonb,
  last_error text,
  lease_owner text,
  lease_expires_at timestamptz,
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, run_key),
  check (jsonb_typeof(stage_receipts) = 'array')
);

create table if not exists public.jhadina_music_autopilot_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.jhadina_music_autopilot_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  action_key text not null,
  stage text not null,
  kind text not null,
  status text not null check (status in ('planned','running','blocked','awaiting_approval','completed','failed','ambiguous')),
  authority text not null,
  authority_ref text,
  evidence_refs jsonb not null default '[]'::jsonb,
  input_refs jsonb not null default '[]'::jsonb,
  output_refs jsonb not null default '[]'::jsonb,
  provider_reference text,
  side_effect_state text not null default 'NONE' check (side_effect_state in ('NONE','CONFIRMED','AMBIGUOUS')),
  attempt integer not null default 0 check (attempt >= 0),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, action_key),
  check (jsonb_typeof(evidence_refs) = 'array'),
  check (jsonb_typeof(input_refs) = 'array'),
  check (jsonb_typeof(output_refs) = 'array')
);

create index if not exists jhadina_music_autopilot_runs_owner_project_status_idx
  on public.jhadina_music_autopilot_runs(user_id, project_id, status, updated_at desc);
create index if not exists jhadina_music_autopilot_actions_run_status_idx
  on public.jhadina_music_autopilot_actions(run_id, status, updated_at desc);

alter table public.jhadina_music_autopilot_charters enable row level security;
alter table public.jhadina_music_autopilot_runs enable row level security;
alter table public.jhadina_music_autopilot_actions enable row level security;

revoke all on public.jhadina_music_autopilot_charters from anon, authenticated;
revoke all on public.jhadina_music_autopilot_runs from anon, authenticated;
revoke all on public.jhadina_music_autopilot_actions from anon, authenticated;

grant select on public.jhadina_music_autopilot_charters to authenticated;
grant select on public.jhadina_music_autopilot_runs to authenticated;
grant select on public.jhadina_music_autopilot_actions to authenticated;

grant all on public.jhadina_music_autopilot_charters to service_role;
grant all on public.jhadina_music_autopilot_runs to service_role;
grant all on public.jhadina_music_autopilot_actions to service_role;

drop policy if exists jhadina_music_autopilot_charters_owner_select on public.jhadina_music_autopilot_charters;
create policy jhadina_music_autopilot_charters_owner_select
  on public.jhadina_music_autopilot_charters for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists jhadina_music_autopilot_runs_owner_select on public.jhadina_music_autopilot_runs;
create policy jhadina_music_autopilot_runs_owner_select
  on public.jhadina_music_autopilot_runs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists jhadina_music_autopilot_actions_owner_select on public.jhadina_music_autopilot_actions;
create policy jhadina_music_autopilot_actions_owner_select
  on public.jhadina_music_autopilot_actions for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.jhadina_music_autopilot_set_charter(
  p_project_id uuid,
  p_enabled boolean,
  p_allowed_social_account_ids jsonb default '[]'::jsonb,
  p_max_director_jobs_per_run integer default 3,
  p_max_social_proposals_per_run integer default 3,
  p_max_preapproved_paid_minor_per_run bigint default 0,
  p_max_preapproved_paid_minor_per_day bigint default 0,
  p_currency text default 'USD',
  p_allow_prepared_assets boolean default true,
  p_allow_approved_content_scheduling boolean default true,
  p_allow_preapproved_paid_tests boolean default false,
  p_pause_on_ambiguous_external_state boolean default true,
  p_paid_authority_ref text default null
) returns public.jhadina_music_autopilot_charters
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_music_autopilot_charters;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.jhadina_music_projects p
    where p.id = p_project_id and p.user_id = v_user
  ) then raise exception 'MUSIC_AUTOPILOT_PROJECT_NOT_FOUND'; end if;
  if jsonb_typeof(coalesce(p_allowed_social_account_ids,'[]'::jsonb)) <> 'array' then
    raise exception 'MUSIC_AUTOPILOT_SOCIAL_SCOPE_INVALID';
  end if;
  if p_max_director_jobs_per_run < 0 or p_max_director_jobs_per_run > 20
     or p_max_social_proposals_per_run < 0 or p_max_social_proposals_per_run > 20
     or p_max_preapproved_paid_minor_per_run < 0
     or p_max_preapproved_paid_minor_per_day < 0
     or p_max_preapproved_paid_minor_per_run > p_max_preapproved_paid_minor_per_day then
    raise exception 'MUSIC_AUTOPILOT_LIMIT_INVALID';
  end if;
  if p_allow_preapproved_paid_tests and (
    p_max_preapproved_paid_minor_per_run <= 0
    or p_max_preapproved_paid_minor_per_day <= 0
    or nullif(trim(coalesce(p_paid_authority_ref,'')), '') is null
  ) then raise exception 'MUSIC_AUTOPILOT_PAID_AUTHORITY_REQUIRED'; end if;

  insert into public.jhadina_music_autopilot_charters(
    user_id,project_id,enabled,allowed_social_account_ids,
    max_director_jobs_per_run,max_social_proposals_per_run,
    max_preapproved_paid_minor_per_run,max_preapproved_paid_minor_per_day,currency,
    allow_prepared_assets,allow_approved_content_scheduling,allow_preapproved_paid_tests,
    pause_on_ambiguous_external_state,paid_authority_ref,updated_at
  ) values (
    v_user,p_project_id,p_enabled,coalesce(p_allowed_social_account_ids,'[]'::jsonb),
    p_max_director_jobs_per_run,p_max_social_proposals_per_run,
    p_max_preapproved_paid_minor_per_run,p_max_preapproved_paid_minor_per_day,upper(trim(p_currency)),
    p_allow_prepared_assets,p_allow_approved_content_scheduling,p_allow_preapproved_paid_tests,
    p_pause_on_ambiguous_external_state,nullif(trim(coalesce(p_paid_authority_ref,'')),''),now()
  )
  on conflict (user_id,project_id) do update set
    enabled=excluded.enabled,
    allowed_social_account_ids=excluded.allowed_social_account_ids,
    max_director_jobs_per_run=excluded.max_director_jobs_per_run,
    max_social_proposals_per_run=excluded.max_social_proposals_per_run,
    max_preapproved_paid_minor_per_run=excluded.max_preapproved_paid_minor_per_run,
    max_preapproved_paid_minor_per_day=excluded.max_preapproved_paid_minor_per_day,
    currency=excluded.currency,
    allow_prepared_assets=excluded.allow_prepared_assets,
    allow_approved_content_scheduling=excluded.allow_approved_content_scheduling,
    allow_preapproved_paid_tests=excluded.allow_preapproved_paid_tests,
    pause_on_ambiguous_external_state=excluded.pause_on_ambiguous_external_state,
    paid_authority_ref=excluded.paid_authority_ref,
    updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.jhadina_music_autopilot_set_charter(uuid,boolean,jsonb,integer,integer,bigint,bigint,text,boolean,boolean,boolean,boolean,text) from public, anon;
grant execute on function public.jhadina_music_autopilot_set_charter(uuid,boolean,jsonb,integer,integer,bigint,bigint,text,boolean,boolean,boolean,boolean,text) to authenticated;

comment on table public.jhadina_music_autopilot_charters is
  'Owner-approved MUSIC-AUTO operating bounds. Does not grant external authority by itself.';
comment on table public.jhadina_music_autopilot_runs is
  'Durable MUSIC-AUTO run/lease state for crash-safe orchestration.';
comment on table public.jhadina_music_autopilot_actions is
  'Idempotent MUSIC-AUTO action ledger. Ambiguous external side effects must reconcile before retry.';
