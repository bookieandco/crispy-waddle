-- STAFFING-AUDIT.2
-- Converge webhook reconciliation onto the canonical Staffing invoice/payment
-- tables created by 0011/0012. The guards keep this migration compatible with
-- the historical 0022-only CI bootstrap; STAFFING-AUDIT.3 resets that fixture
-- and proves the real complete migration chain from a blank database.

do $$
begin
  if to_regclass('public.staffing_invoices') is not null then
    execute 'alter table public.staffing_invoices drop constraint if exists staffing_invoices_status_check';
    execute $constraint$
      alter table public.staffing_invoices
      add constraint staffing_invoices_status_check
      check (status in ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','VOID','OVERDUE'))
    $constraint$;
  end if;
end
$$;

create table if not exists public.staffing_payments (
  id text primary key,
  organization_id uuid not null,
  invoice_id text not null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  status text not null default 'RECEIVED',
  received_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.staffing_payments
  add column if not exists provider text,
  add column if not exists external_payment_id text,
  add column if not exists employer_id text,
  alter column created_at set default now();

alter table public.staffing_payments
  drop constraint if exists staffing_payments_status_check;
alter table public.staffing_payments
  add constraint staffing_payments_status_check
  check (status in ('PENDING','RECEIVED','SETTLED','FAILED','REFUNDED'));

create unique index if not exists staffing_payments_provider_event_idx
  on public.staffing_payments (organization_id, provider, external_payment_id)
  where provider is not null and external_payment_id is not null;

create table if not exists public.staffing_cash_ledger_entries (
  id text primary key,
  organization_id uuid not null,
  invoice_id text not null,
  payment_id text not null references public.staffing_payments(id),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  occurred_at timestamptz not null,
  unique (organization_id, payment_id)
);

alter table public.staffing_payments enable row level security;
alter table public.staffing_cash_ledger_entries enable row level security;

drop policy if exists "staffing payments organization access" on public.staffing_payments;
create policy "staffing payments organization access" on public.staffing_payments
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));

drop policy if exists "staffing cash ledger organization access" on public.staffing_cash_ledger_entries;
create policy "staffing cash ledger organization access" on public.staffing_cash_ledger_entries
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
