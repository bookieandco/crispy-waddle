-- VENTURE-LIVE.1-.4: durable Venture Factory runtime.
-- Global market-scout inbox is read-only to authenticated users.
-- User venture state is service-role written after an authenticated HTTP boundary.
-- None of these tables grants publishing, outreach, commerce, payment, or money-movement authority.

create table if not exists public.jhadina_venture_signal_inbox (
  id text primary key,
  seed_id text not null,
  family text not null,
  signal_kind text not null,
  source_ref text not null,
  source_url text,
  source_title text not null,
  observed_at timestamptz not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  payload jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_venture_signal_inbox_seed_time_idx
  on public.jhadina_venture_signal_inbox(seed_id, observed_at desc);
create index if not exists jhadina_venture_signal_inbox_family_time_idx
  on public.jhadina_venture_signal_inbox(family, observed_at desc);

create table if not exists public.jhadina_venture_records (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  family text not null,
  lifecycle text not null,
  score double precision not null,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (owner_user_id, id),
  foreign key (owner_user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_venture_records_owner_stage_idx
  on public.jhadina_venture_records(owner_user_id, lifecycle, score desc, updated_at desc);

create table if not exists public.jhadina_venture_work_items (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  venture_id text not null,
  agent_id text not null,
  step text not null,
  status text not null,
  spend_usd double precision not null default 0 check (spend_usd >= 0),
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (owner_user_id, id),
  foreign key (owner_user_id, venture_id)
    references public.jhadina_venture_records(owner_user_id, id) on delete cascade
);

create index if not exists jhadina_venture_work_items_owner_venture_status_idx
  on public.jhadina_venture_work_items(owner_user_id, venture_id, status, updated_at desc);

create table if not exists public.jhadina_venture_supervisor_issues (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  venture_id text not null,
  kind text not null,
  severity text not null,
  recommended_action text not null,
  payload jsonb not null,
  detected_at timestamptz not null,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, id),
  foreign key (owner_user_id, venture_id)
    references public.jhadina_venture_records(owner_user_id, id) on delete cascade
);

create index if not exists jhadina_venture_supervisor_issues_open_idx
  on public.jhadina_venture_supervisor_issues(owner_user_id, venture_id, resolved_at, detected_at desc);

create table if not exists public.jhadina_venture_memory (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  venture_id text not null,
  family text not null,
  scope text not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 100),
  payload jsonb not null,
  observed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, id),
  foreign key (owner_user_id, venture_id)
    references public.jhadina_venture_records(owner_user_id, id) on delete cascade
);

create index if not exists jhadina_venture_memory_owner_scope_idx
  on public.jhadina_venture_memory(owner_user_id, scope, observed_at desc);

create table if not exists public.jhadina_venture_runtime_receipts (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  venture_id text,
  kind text not null check (kind in ('market_scout','supervisor','spatial_projection','experiment_bridge','outcome_bridge')),
  evidence_refs text[] not null default '{}',
  payload jsonb not null,
  recorded_at timestamptz not null,
  primary key (owner_user_id, id),
  foreign key (owner_user_id, venture_id)
    references public.jhadina_venture_records(owner_user_id, id) on delete cascade
);

create index if not exists jhadina_venture_runtime_receipts_owner_kind_idx
  on public.jhadina_venture_runtime_receipts(owner_user_id, kind, recorded_at desc);

alter table public.jhadina_venture_signal_inbox enable row level security;
alter table public.jhadina_venture_records enable row level security;
alter table public.jhadina_venture_work_items enable row level security;
alter table public.jhadina_venture_supervisor_issues enable row level security;
alter table public.jhadina_venture_memory enable row level security;
alter table public.jhadina_venture_runtime_receipts enable row level security;

drop policy if exists "jhadina_venture_signal_inbox_authenticated_read" on public.jhadina_venture_signal_inbox;
create policy "jhadina_venture_signal_inbox_authenticated_read"
  on public.jhadina_venture_signal_inbox
  for select to authenticated
  using (true);

drop policy if exists "jhadina_venture_records_select_own" on public.jhadina_venture_records;
create policy "jhadina_venture_records_select_own"
  on public.jhadina_venture_records
  for select to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists "jhadina_venture_work_items_select_own" on public.jhadina_venture_work_items;
create policy "jhadina_venture_work_items_select_own"
  on public.jhadina_venture_work_items
  for select to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists "jhadina_venture_supervisor_issues_select_own" on public.jhadina_venture_supervisor_issues;
create policy "jhadina_venture_supervisor_issues_select_own"
  on public.jhadina_venture_supervisor_issues
  for select to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists "jhadina_venture_memory_select_own" on public.jhadina_venture_memory;
create policy "jhadina_venture_memory_select_own"
  on public.jhadina_venture_memory
  for select to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists "jhadina_venture_runtime_receipts_select_own" on public.jhadina_venture_runtime_receipts;
create policy "jhadina_venture_runtime_receipts_select_own"
  on public.jhadina_venture_runtime_receipts
  for select to authenticated
  using (auth.uid() = owner_user_id);

revoke all on public.jhadina_venture_signal_inbox from public, anon;
revoke all on public.jhadina_venture_records from public, anon;
revoke all on public.jhadina_venture_work_items from public, anon;
revoke all on public.jhadina_venture_supervisor_issues from public, anon;
revoke all on public.jhadina_venture_memory from public, anon;
revoke all on public.jhadina_venture_runtime_receipts from public, anon;

revoke insert, update, delete on public.jhadina_venture_signal_inbox from authenticated;
revoke insert, update, delete on public.jhadina_venture_records from authenticated;
revoke insert, update, delete on public.jhadina_venture_work_items from authenticated;
revoke insert, update, delete on public.jhadina_venture_supervisor_issues from authenticated;
revoke insert, update, delete on public.jhadina_venture_memory from authenticated;
revoke insert, update, delete on public.jhadina_venture_runtime_receipts from authenticated;

grant select on public.jhadina_venture_signal_inbox to authenticated;
grant select on public.jhadina_venture_records to authenticated;
grant select on public.jhadina_venture_work_items to authenticated;
grant select on public.jhadina_venture_supervisor_issues to authenticated;
grant select on public.jhadina_venture_memory to authenticated;
grant select on public.jhadina_venture_runtime_receipts to authenticated;

grant select, insert, update, delete on public.jhadina_venture_signal_inbox to service_role;
grant select, insert, update, delete on public.jhadina_venture_records to service_role;
grant select, insert, update, delete on public.jhadina_venture_work_items to service_role;
grant select, insert, update, delete on public.jhadina_venture_supervisor_issues to service_role;
grant select, insert, update, delete on public.jhadina_venture_memory to service_role;
grant select, insert, update, delete on public.jhadina_venture_runtime_receipts to service_role;
