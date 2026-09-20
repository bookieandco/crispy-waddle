create table if not exists public.jhadina_safety_runtime_proofs (
  proof_id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references public.jhadina_safety_live_admissions(admission_id) on delete cascade,
  owner_id text not null,
  kind text not null,
  passed boolean not null,
  observed_at timestamptz not null,
  evidence_ref text not null check (length(evidence_ref) > 0),
  device_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(admission_id, kind, evidence_ref)
);

alter table public.jhadina_safety_runtime_proofs enable row level security;

create index if not exists jhadina_safety_runtime_proofs_admission_idx
on public.jhadina_safety_runtime_proofs(admission_id, observed_at desc);

comment on table public.jhadina_safety_runtime_proofs is
'Immutable evidence references consumed by SAFETY-PROD-GATE.5. Service-role governed writes only.';
