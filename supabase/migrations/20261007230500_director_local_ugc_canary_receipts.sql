-- Durable point-in-time evidence for DIRECTOR-LOCAL-UGC.FINAL commissioning.
-- This table is an append-only evidence/reconciliation ledger. It grants no
-- compute, spend, creative approval, publication, or wagering authority.

create table if not exists public.director_local_ugc_canary_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  canary_id text not null,
  next_boundary text not null,
  admissible_to_advance boolean not null,
  complete boolean not null,
  blockers text[] not null default '{}',
  evidence_ids text[] not null default '{}',
  realized_accepted_output_cost_usd numeric(18,6),
  snapshot_sha256 text not null,
  commissioning_decision jsonb not null,
  canary_state jsonb not null,
  authority text not null default 'DIRECTOR_LOCAL_UGC_CANARY_COMMISSIONING_EVIDENCE',
  observed_at timestamptz not null default now(),
  check (length(trim(canary_id)) > 0),
  check (snapshot_sha256 ~ '^[a-f0-9]{64}
  check (jsonb_typeof(canary_state)='object'),
  check (
    realized_accepted_output_cost_usd is null
    or realized_accepted_output_cost_usd >= 0
  ),
  check (authority='DIRECTOR_LOCAL_UGC_CANARY_COMMISSIONING_EVIDENCE')
);

create index if not exists director_local_ugc_canary_project_idx
  on public.director_local_ugc_canary_receipts(project_id,observed_at desc);

create index if not exists director_local_ugc_canary_owner_idx
  on public.director_local_ugc_canary_receipts(owner_user_id,observed_at desc);

create index if not exists director_local_ugc_canary_identity_idx
  on public.director_local_ugc_canary_receipts(
    project_id,owner_user_id,canary_id,observed_at desc
  );

create unique index if not exists director_local_ugc_canary_snapshot_unique
  on public.director_local_ugc_canary_receipts(
    project_id,owner_user_id,canary_id,snapshot_sha256
  );

alter table public.director_local_ugc_canary_receipts enable row level security;

revoke all on public.director_local_ugc_canary_receipts
  from public,anon,authenticated;

grant select,insert on public.director_local_ugc_canary_receipts to service_role;

drop policy if exists director_local_ugc_canary_receipts_service_role_only
  on public.director_local_ugc_canary_receipts;

create policy director_local_ugc_canary_receipts_service_role_only
  on public.director_local_ugc_canary_receipts
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_local_ugc_canary_receipts is
'Append-only evidence snapshots for DIRECTOR-LOCAL-UGC.FINAL commissioning. Stores the validated receipt chain and exact next boundary; never grants compute, spend, creative approval, publication, or wagering authority.';
),
  check (jsonb_typeof(commissioning_decision)='object'),
  check (jsonb_typeof(canary_state)='object'),
  check (
    realized_accepted_output_cost_usd is null
    or realized_accepted_output_cost_usd >= 0
  ),
  check (authority='DIRECTOR_LOCAL_UGC_CANARY_COMMISSIONING_EVIDENCE')
);

create index if not exists director_local_ugc_canary_project_idx
  on public.director_local_ugc_canary_receipts(project_id,observed_at desc);

create index if not exists director_local_ugc_canary_owner_idx
  on public.director_local_ugc_canary_receipts(owner_user_id,observed_at desc);

create index if not exists director_local_ugc_canary_identity_idx
  on public.director_local_ugc_canary_receipts(
    project_id,owner_user_id,canary_id,observed_at desc
  );

alter table public.director_local_ugc_canary_receipts enable row level security;

revoke all on public.director_local_ugc_canary_receipts
  from public,anon,authenticated;

grant select,insert on public.director_local_ugc_canary_receipts to service_role;

drop policy if exists director_local_ugc_canary_receipts_service_role_only
  on public.director_local_ugc_canary_receipts;

create policy director_local_ugc_canary_receipts_service_role_only
  on public.director_local_ugc_canary_receipts
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_local_ugc_canary_receipts is
'Append-only evidence snapshots for DIRECTOR-LOCAL-UGC.FINAL commissioning. Stores the validated receipt chain and exact next boundary; never grants compute, spend, creative approval, publication, or wagering authority.';
