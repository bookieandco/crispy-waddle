create table if not exists public.staffing_jobs (
  id text primary key,
  organization_id uuid not null,
  employer_id uuid not null,
  title text not null,
  description text not null,
  location text not null,
  pay_rate numeric(14,2) not null check (pay_rate > 0),
  currency text not null check (char_length(currency) = 3),
  remote boolean not null default false,
  status text not null check (status in ('DRAFT','PUBLISHED','PAUSED','CLOSED')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists staffing_jobs_marketplace_idx
  on public.staffing_jobs (organization_id, status, created_at desc);

create table if not exists public.staffing_event_outbox (
  id text primary key,
  event_type text not null,
  aggregate_id text not null,
  organization_id uuid not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','PUBLISHED','FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  published_at timestamptz,
  last_error text
);

create index if not exists staffing_outbox_pending_idx
  on public.staffing_event_outbox (status, available_at, occurred_at);

create table if not exists public.staffing_commercial_ledger (
  id text primary key,
  organization_id uuid not null,
  placement_id uuid not null,
  invoice_id uuid not null,
  agreement_id uuid not null,
  entry_type text not null check (entry_type in ('PLATFORM_FEE','AGENCY_REVENUE','PLATFORM_REVENUE')),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null check (char_length(currency) = 3),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists staffing_commercial_ledger_invoice_idx
  on public.staffing_commercial_ledger (invoice_id, occurred_at);
create index if not exists staffing_commercial_ledger_placement_idx
  on public.staffing_commercial_ledger (placement_id, occurred_at);

create table if not exists public.staffing_financial_idempotency (
  organization_id uuid not null,
  idempotency_key text not null,
  operation text not null,
  invoice_id uuid not null,
  created_at timestamptz not null,
  primary key (organization_id, idempotency_key)
);

-- Historical financial records should not be mutable through the normal API.
create or replace function public.staffing_deny_financial_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'staffing financial ledger entries are append-only';
end;
$$;

drop trigger if exists staffing_commercial_ledger_no_update on public.staffing_commercial_ledger;
create trigger staffing_commercial_ledger_no_update
before update or delete on public.staffing_commercial_ledger
for each row execute function public.staffing_deny_financial_ledger_mutation();

alter table public.staffing_jobs enable row level security;
alter table public.staffing_event_outbox enable row level security;
alter table public.staffing_commercial_ledger enable row level security;
alter table public.staffing_financial_idempotency enable row level security;

create policy "staffing jobs organization access" on public.staffing_jobs
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));

create policy "staffing outbox organization access" on public.staffing_event_outbox
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));

create policy "staffing commercial ledger organization access" on public.staffing_commercial_ledger
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));

create policy "staffing financial idempotency organization access" on public.staffing_financial_idempotency
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
