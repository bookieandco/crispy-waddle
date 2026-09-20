create table if not exists public.jhadina_safety_live_admissions (
  admission_id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  device_ref text not null,
  gate_version text not null check (gate_version = 'SAFETY-PROD-GATE.4'),
  admitted boolean not null default false,
  evaluated_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  blockers jsonb not null default '[]'::jsonb check (jsonb_typeof(blockers) = 'array'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.jhadina_safety_live_admissions enable row level security;

create index if not exists jhadina_safety_live_admissions_owner_device_idx
on public.jhadina_safety_live_admissions(owner_id, device_ref, evaluated_at desc);

comment on table public.jhadina_safety_live_admissions is
'Fail-closed SAFETY-PROD-GATE.4 admission receipts. Service-role governed path only; no end-user RLS policy.';
