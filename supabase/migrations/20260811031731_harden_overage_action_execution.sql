create unique index if not exists overage_action_envelopes_idempotency_key_uq on public.overage_action_envelopes (idempotency_key);

create table if not exists public.overage_action_audit (
  id uuid primary key default gen_random_uuid(),
  action_id text not null,
  opportunity_id uuid null references public.overage_opportunities(id) on delete set null,
  event_type text not null,
  status text not null,
  provider_ref text null,
  safe_error_class text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists overage_action_audit_action_id_idx on public.overage_action_audit(action_id, created_at desc);
create index if not exists overage_action_audit_opportunity_id_idx on public.overage_action_audit(opportunity_id, created_at desc);

alter table public.overage_action_audit enable row level security;

create policy "authenticated can read overage action audit"
on public.overage_action_audit for select
to authenticated using (true);

create policy "authenticated can insert overage action audit"
on public.overage_action_audit for insert
to authenticated with check (true);
