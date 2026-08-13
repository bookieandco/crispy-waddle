create table if not exists public.staffing_invoices (
  id text primary key,
  organization_id uuid not null,
  placement_id text not null references public.staffing_placements(id),
  timesheet_id text not null references public.staffing_timesheets(id),
  agreement_id text not null,
  currency text not null check (char_length(currency) = 3),
  subtotal numeric(14,2) not null check (subtotal > 0),
  status text not null check (status in ('ISSUED','VOID','PAID')),
  issued_at timestamptz not null,
  created_at timestamptz not null
);

create unique index if not exists staffing_invoices_timesheet_idx
  on public.staffing_invoices (timesheet_id);

create index if not exists staffing_invoices_org_status_idx
  on public.staffing_invoices (organization_id, status, issued_at desc);

create table if not exists public.staffing_invoice_lines (
  id text primary key,
  invoice_id text not null references public.staffing_invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_rate numeric(14,2) not null check (unit_rate >= 0),
  amount numeric(14,2) not null check (amount >= 0)
);

create index if not exists staffing_invoice_lines_invoice_idx
  on public.staffing_invoice_lines (invoice_id);

alter table public.staffing_invoices enable row level security;
alter table public.staffing_invoice_lines enable row level security;

create policy "staffing invoices organization access" on public.staffing_invoices
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));

create policy "staffing invoice lines organization access" on public.staffing_invoice_lines
for all using (exists (
  select 1 from public.staffing_invoices i
  where i.id = invoice_id and public.placement_is_org_member(i.organization_id)
))
with check (exists (
  select 1 from public.staffing_invoices i
  where i.id = invoice_id and public.placement_is_org_member(i.organization_id)
));
