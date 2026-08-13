create table if not exists public.staffing_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employer_id uuid not null,
  agency_id uuid not null,
  timesheet_id uuid not null,
  invoice_number text not null,
  currency text not null,
  subtotal numeric(14,2) not null check (subtotal >= 0),
  total numeric(14,2) not null check (total >= 0),
  due_at timestamptz not null,
  status text not null check (status in ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','VOID','OVERDUE')),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create table if not exists public.staffing_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null references public.staffing_invoices(id),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  status text not null check (status in ('PENDING','SETTLED','FAILED','REFUNDED')),
  external_reference text,
  idempotency_key text not null,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists public.staffing_revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null references public.staffing_invoices(id),
  payment_id uuid references public.staffing_payments(id),
  type text not null check (type in ('INVOICE_ISSUED','PAYMENT_RECEIVED','PLATFORM_FEE','REFUND')),
  amount numeric(14,2) not null,
  currency text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists staffing_invoices_due_idx on public.staffing_invoices (organization_id, status, due_at);
create index if not exists staffing_payments_invoice_idx on public.staffing_payments (organization_id, invoice_id, status);
create index if not exists staffing_ledger_invoice_idx on public.staffing_revenue_ledger (organization_id, invoice_id, occurred_at);

alter table public.staffing_invoices enable row level security;
alter table public.staffing_payments enable row level security;
alter table public.staffing_revenue_ledger enable row level security;

create policy "staffing invoice organization access" on public.staffing_invoices
  for all using (public.placement_is_org_member(organization_id))
  with check (public.placement_is_org_member(organization_id));

create policy "staffing payment organization access" on public.staffing_payments
  for all using (public.placement_is_org_member(organization_id))
  with check (public.placement_is_org_member(organization_id));

create policy "staffing ledger organization access" on public.staffing_revenue_ledger
  for select using (public.placement_is_org_member(organization_id));
