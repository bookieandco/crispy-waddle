create table if not exists public.jhadina_artifacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  original_name text not null,
  declared_mime_type text not null,
  detected_mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_bucket text not null,
  storage_path text not null,
  status text not null check (status in ('quarantine','clean','rejected','needs_review')),
  scan_reasons jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  derivative_refs jsonb not null default '[]'::jsonb,
  extracted_text_ref text,
  created_at timestamptz not null default now(),
  scanned_at timestamptz,
  unique(owner_user_id,sha256,storage_path)
);
alter table public.jhadina_artifacts enable row level security;
revoke all on public.jhadina_artifacts from anon, authenticated;
grant select,insert,update,delete on public.jhadina_artifacts to service_role;
comment on table public.jhadina_artifacts is 'Quarantined universal Jhadina artifact metadata. Uploaded files are never executable and cannot enter trusted context until clean.';
create index if not exists jhadina_artifacts_owner_created_idx on public.jhadina_artifacts(owner_user_id,created_at desc);
