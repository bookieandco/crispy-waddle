create table if not exists public.staffing_payments (
  id text primary key,
  organization_id uuid not null,
  invoice_id text not null references public.staffing_invoices(id),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  status text not null check (status in ('PENDING','RECEIVED','FAILED','REFUNDED')),
  received_at timestamptz,
  created_at timestamptz not null
);

create index if not exists staffing_payments_invoice_status_idx
  on public.staffing_payments (invoice_id, status);

create index if not exists staffing_payments_org_received_idx
  on public.staffing_payments (organization_id, received_at desc);

alter table public.staffing_payments enable row level security;

create policy "staffing payments organization access" on public.staffing_payments
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
