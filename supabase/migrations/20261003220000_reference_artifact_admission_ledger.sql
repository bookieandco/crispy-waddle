-- REF-PROV-06 durable artifact admission/attestation ledger for production Director.
-- Service-role-only and append-only. Mirrors the reference-provenance package contract.

create table if not exists public.reference_artifact_admissions (
  admission_id text primary key,
  receipt_hash text not null unique,
  artifact_id text not null,
  pin_id text not null,
  runtime_instance_scope jsonb not null,
  admitted_at timestamptz not null,
  receipt_json jsonb not null,
  created_at timestamptz not null default now(),
  check (receipt_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists idx_reference_artifact_admissions_artifact
  on public.reference_artifact_admissions (artifact_id, admitted_at desc);

create table if not exists public.reference_artifact_attestations (
  attestation_id text primary key,
  attestation_hash text not null unique,
  admission_id text not null
    references public.reference_artifact_admissions(admission_id)
    on delete restrict,
  admission_receipt_hash text not null,
  artifact_id text not null,
  pin_id text not null,
  runtime_instance_id text not null,
  loaded_at timestamptz not null,
  attestation_json jsonb not null,
  created_at timestamptz not null default now(),
  check (attestation_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists idx_reference_artifact_attestations_runtime
  on public.reference_artifact_attestations (
    runtime_instance_id,
    artifact_id,
    loaded_at desc
  );

create or replace function public.prevent_reference_artifact_ledger_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'reference artifact provenance ledger is append-only';
end;
$$;

drop trigger if exists reference_artifact_admissions_append_only
  on public.reference_artifact_admissions;
create trigger reference_artifact_admissions_append_only
before update or delete on public.reference_artifact_admissions
for each row execute function public.prevent_reference_artifact_ledger_mutation();

drop trigger if exists reference_artifact_attestations_append_only
  on public.reference_artifact_attestations;
create trigger reference_artifact_attestations_append_only
before update or delete on public.reference_artifact_attestations
for each row execute function public.prevent_reference_artifact_ledger_mutation();

alter table public.reference_artifact_admissions enable row level security;
alter table public.reference_artifact_attestations enable row level security;

revoke all on public.reference_artifact_admissions from public, anon, authenticated;
revoke all on public.reference_artifact_attestations from public, anon, authenticated;

grant select, insert on public.reference_artifact_admissions to service_role;
grant select, insert on public.reference_artifact_attestations to service_role;

drop policy if exists reference_artifact_admissions_service_role_only
  on public.reference_artifact_admissions;
create policy reference_artifact_admissions_service_role_only
  on public.reference_artifact_admissions
  as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists reference_artifact_attestations_service_role_only
  on public.reference_artifact_attestations;
create policy reference_artifact_attestations_service_role_only
  on public.reference_artifact_attestations
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.reference_artifact_admissions is
'Append-only REF-PROV-06 artifact admission receipts. Service-role only.';
comment on table public.reference_artifact_attestations is
'Append-only REF-PROV-06 runtime artifact attestations. Service-role only.';
