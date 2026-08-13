create table if not exists public.staffing_ledger_entries (
  id text primary key,
  organization_id uuid not null,
  placement_id text references public.staffing_placements(id),
  invoice_id text references public.staffing_invoices(id),
  payment_id text references public.staffing_payments(id),
  agreement_id text,
  type text not null check (type in ('AGENCY_REVENUE','PLATFORM_REVENUE','PAYMENT_RECEIVED')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  occurred_at timestamptz not null,
  source_id text not null
);

create unique index if not exists staffing_ledger_source_type_idx
  on public.staffing_ledger_entries (organization_id, source_id, type);

create index if not exists staffing_ledger_org_time_idx
  on public.staffing_ledger_entries (organization_id, occurred_at desc);

create index if not exists staffing_ledger_invoice_idx
  on public.staffing_ledger_entries (invoice_id);

create index if not exists staffing_ledger_payment_idx
  on public.staffing_ledger_entries (payment_id);

alter table public.staffing_ledger_entries enable row level security;

create policy "staffing financial ledger organization access" on public.staffing_ledger_entries
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
