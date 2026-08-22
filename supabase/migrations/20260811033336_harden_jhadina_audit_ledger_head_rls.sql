alter table public.jhadina_audit_ledger_head enable row level security;

create policy "jhadina audit head service role only"
on public.jhadina_audit_ledger_head
as restrictive
for all
to service_role
using (true)
with check (true);
