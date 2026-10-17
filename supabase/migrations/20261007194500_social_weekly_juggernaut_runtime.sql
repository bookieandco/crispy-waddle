-- SOCIAL-JUGGERNAUT weekly governed runtime.
-- Source migration only until SWLC production health/storage is recovered.

create table if not exists public.jhadina_social_weekly_packets (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  week_starts_at timestamptz not null,
  week_ends_at timestamptz not null,
  packet_fingerprint text not null,
  packet_payload jsonb not null check (jsonb_typeof(packet_payload) = 'object'),
  report_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(report_payload) = 'object'),
  status text not null default 'draft' check (status in (
    'draft','pending_approval','approved','active','completed','failed','cancelled'
  )),
  approval_receipt_id text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, packet_fingerprint),
  check (week_ends_at > week_starts_at),
  check (
    (status in ('approved','active','completed') and approval_receipt_id is not null and approved_at is not null)
    or status in ('draft','pending_approval','failed','cancelled')
  )
);

comment on table public.jhadina_social_weekly_packets is
  'Owner-approved immutable weekly Social Juggernaut packets and report snapshots. Approval covers only the exact packet fingerprint.';

create table if not exists public.jhadina_social_weekly_action_state (
  user_id uuid not null,
  packet_id text not null,
  action_id text not null,
  campaign_id text not null,
  action_kind text not null check (action_kind in (
    'organic_publication','public_comment','paid_campaign','director_production'
  )),
  permit_id text,
  action_fingerprint text not null,
  scheduled_at timestamptz not null,
  status text not null default 'planned' check (status in (
    'planned','ready','running','waiting','completed','failed','ambiguous','cancelled'
  )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  external_receipt_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(external_receipt_refs) = 'array'),
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (user_id, packet_id, action_id),
  foreign key (user_id, packet_id)
    references public.jhadina_social_weekly_packets(user_id, id)
    on delete cascade
);

create unique index if not exists jhadina_social_weekly_action_permit_uidx
  on public.jhadina_social_weekly_action_state(user_id, permit_id)
  where permit_id is not null;

create index if not exists jhadina_social_weekly_action_due_idx
  on public.jhadina_social_weekly_action_state(user_id, status, scheduled_at);

comment on table public.jhadina_social_weekly_action_state is
  'Restart-safe child action state for an exact approved weekly packet. No row grants authority by itself.';

create table if not exists public.jhadina_social_weekly_permit_consumptions (
  user_id uuid not null,
  permit_id text not null,
  packet_id text not null,
  action_id text not null,
  action_fingerprint text not null,
  consumed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, permit_id),
  foreign key (user_id, packet_id, action_id)
    references public.jhadina_social_weekly_action_state(user_id, packet_id, action_id)
    on delete restrict
);

comment on table public.jhadina_social_weekly_permit_consumptions is
  'Single-use durable consumption ledger for weekly child delegation permits.';

create table if not exists public.jhadina_social_weekly_reports (
  user_id uuid not null,
  id text not null,
  packet_id text not null,
  report_payload jsonb not null check (jsonb_typeof(report_payload) = 'object'),
  generated_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, packet_id)
    references public.jhadina_social_weekly_packets(user_id, id)
    on delete cascade
);

comment on table public.jhadina_social_weekly_reports is
  'Immutable-ish weekly owner report snapshots: plans, spend, experiments, scale/kill decisions, blockers, and admitted learnings.';

create table if not exists public.jhadina_social_engagement_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  brand text not null,
  platform text not null,
  account_ref text not null,
  handle_or_label text not null,
  source text not null check (source in ('owner_curated','jhadina_discovered')),
  status text not null default 'active' check (status in ('active','paused','retired')),
  priority integer not null default 60 check (priority between 0 and 100),
  topic_tags text[] not null default '{}',
  campaign_refs text[] not null default '{}',
  notes text,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, brand, platform, account_ref)
);

create index if not exists jhadina_social_engagement_targets_active_idx
  on public.jhadina_social_engagement_targets(user_id, brand, platform, priority desc)
  where status = 'active';

comment on table public.jhadina_social_engagement_targets is
  'Owner-curated and Jhadina-discovered public accounts to monitor for relevant engagement opportunities. Target membership never bypasses relevance or weekly public-action approval.';

alter table public.jhadina_social_weekly_packets enable row level security;
alter table public.jhadina_social_weekly_action_state enable row level security;
alter table public.jhadina_social_weekly_permit_consumptions enable row level security;
alter table public.jhadina_social_weekly_reports enable row level security;
alter table public.jhadina_social_engagement_targets enable row level security;

revoke all on table public.jhadina_social_weekly_packets from public, anon, authenticated;
revoke all on table public.jhadina_social_weekly_action_state from public, anon, authenticated;
revoke all on table public.jhadina_social_weekly_permit_consumptions from public, anon, authenticated;
revoke all on table public.jhadina_social_weekly_reports from public, anon, authenticated;
revoke all on table public.jhadina_social_engagement_targets from public, anon;

grant all on table public.jhadina_social_weekly_packets to service_role;
grant all on table public.jhadina_social_weekly_action_state to service_role;
grant all on table public.jhadina_social_weekly_permit_consumptions to service_role;
grant all on table public.jhadina_social_weekly_reports to service_role;
grant all on table public.jhadina_social_engagement_targets to service_role;

grant select on table public.jhadina_social_weekly_packets to authenticated;
grant select on table public.jhadina_social_weekly_action_state to authenticated;
grant select on table public.jhadina_social_weekly_reports to authenticated;
grant select, insert, update, delete on table public.jhadina_social_engagement_targets to authenticated;

drop policy if exists social_weekly_packets_owner_select on public.jhadina_social_weekly_packets;
create policy social_weekly_packets_owner_select
  on public.jhadina_social_weekly_packets
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists social_weekly_action_owner_select on public.jhadina_social_weekly_action_state;
create policy social_weekly_action_owner_select
  on public.jhadina_social_weekly_action_state
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists social_weekly_reports_owner_select on public.jhadina_social_weekly_reports;
create policy social_weekly_reports_owner_select
  on public.jhadina_social_weekly_reports
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists social_engagement_targets_owner_select on public.jhadina_social_engagement_targets;
create policy social_engagement_targets_owner_select
  on public.jhadina_social_engagement_targets
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists social_engagement_targets_owner_insert on public.jhadina_social_engagement_targets;
create policy social_engagement_targets_owner_insert
  on public.jhadina_social_engagement_targets
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists social_engagement_targets_owner_update on public.jhadina_social_engagement_targets;
create policy social_engagement_targets_owner_update
  on public.jhadina_social_engagement_targets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists social_engagement_targets_owner_delete on public.jhadina_social_engagement_targets;
create policy social_engagement_targets_owner_delete
  on public.jhadina_social_engagement_targets
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.jhadina_social_consume_weekly_permit(
  p_user_id uuid,
  p_packet_id text,
  p_permit_id text,
  p_action_id text,
  p_action_fingerprint text,
  p_consumed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_permit text;
begin
  if p_consumed_at is null then
    raise exception 'SOCIAL_WEEKLY_PERMIT_CONSUMED_AT_REQUIRED';
  end if;

  if not exists (
    select 1
      from public.jhadina_social_weekly_packets p
      join public.jhadina_social_weekly_action_state a
        on a.user_id = p.user_id
       and a.packet_id = p.id
     where p.user_id = p_user_id
       and p.id = p_packet_id
       and p.status in ('approved','active')
       and p.approved_at is not null
       and p.approved_at <= p_consumed_at
       and p.week_ends_at > p_consumed_at
       and a.action_id = p_action_id
       and a.permit_id = p_permit_id
       and a.action_fingerprint = p_action_fingerprint
       and a.status not in ('completed','cancelled')
  ) then
    return false;
  end if;

  insert into public.jhadina_social_weekly_permit_consumptions(
    user_id, permit_id, packet_id, action_id, action_fingerprint, consumed_at
  )
  values (
    p_user_id, p_permit_id, p_packet_id, p_action_id, p_action_fingerprint, p_consumed_at
  )
  on conflict (user_id, permit_id) do nothing
  returning permit_id into inserted_permit;

  return inserted_permit is not null;
end;
$$;

revoke all on function public.jhadina_social_consume_weekly_permit(uuid,text,text,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.jhadina_social_consume_weekly_permit(uuid,text,text,text,text,timestamptz)
  to service_role;
