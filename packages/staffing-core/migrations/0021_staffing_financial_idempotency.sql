create table if not exists public.staffing_financial_operations (
  operation_key text primary key,
  organization_id uuid not null,
  placement_id text not null,
  timesheet_id text not null,
  invoice_id text,
  status text not null check (status in ('PROCESSING','COMPLETED','FAILED')),
  result_json jsonb,
  created_at timestamptz not null,
  completed_at timestamptz
);

create unique index if not exists staffing_financial_operations_timesheet_idx
  on public.staffing_financial_operations (organization_id, timesheet_id);

alter table public.staffing_financial_operations enable row level security;
create policy "staffing financial operations organization access" on public.staffing_financial_operations
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));

create unique index if not exists staffing_commercial_ledger_entry_idempotency_idx
  on public.staffing_commercial_ledger (placement_id, invoice_id, agreement_id, type);
