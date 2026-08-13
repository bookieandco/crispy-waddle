create table if not exists public.staffing_payment_ledger_postings (
  id text primary key,
  payment_id text not null unique references public.staffing_payments(id),
  organization_id uuid not null,
  invoice_id text not null references public.staffing_invoices(id),
  placement_id text not null references public.staffing_placements(id),
  agreement_id text not null,
  currency text not null check (char_length(currency) = 3),
  amount numeric(14,2) not null check (amount > 0),
  posted_at timestamptz not null
);

create index if not exists staffing_payment_ledger_org_posted_idx
  on public.staffing_payment_ledger_postings (organization_id, posted_at desc);

alter table public.staffing_payment_ledger_postings enable row level security;

create policy "staffing payment ledger organization access" on public.staffing_payment_ledger_postings
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
