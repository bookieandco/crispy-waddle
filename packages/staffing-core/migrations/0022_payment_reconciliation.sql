create table if not exists public.staffing_payments (
  id uuid primary key,
  organization_id uuid not null,
  provider text not null,
  external_payment_id text not null,
  invoice_id uuid not null,
  employer_id uuid not null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null,
  received_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, provider, external_payment_id)
);

create table if not exists public.staffing_cash_ledger_entries (
  id uuid primary key,
  organization_id uuid not null,
  invoice_id uuid not null,
  payment_id uuid not null references public.staffing_payments(id),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null,
  occurred_at timestamptz not null,
  unique (organization_id, payment_id)
);

alter table public.staffing_payments enable row level security;
alter table public.staffing_cash_ledger_entries enable row level security;

create policy "staffing payments organization access" on public.staffing_payments
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));

create policy "staffing cash ledger organization access" on public.staffing_cash_ledger_entries
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
