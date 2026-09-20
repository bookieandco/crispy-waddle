-- SAFETY-PROD durable runtime schema.
-- Sensitive profile content and evidence payloads remain encrypted outside these metadata rows.

create table if not exists public.jhadina_safety_incidents (
  incident_id text primary key,
  owner_id text not null,
  protocol_id text not null,
  dead_man_state text not null,
  deadline_at timestamptz,
  timeline jsonb not null default '[]'::jsonb check (jsonb_typeof(timeline) = 'array'),
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_safety_personal_profiles (
  owner_id text primary key,
  profile_id text not null unique,
  ciphertext_ref text not null,
  key_id text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_safety_evidence_manifest (
  chunk_id text primary key,
  incident_id text not null references public.jhadina_safety_incidents(incident_id) on delete cascade,
  sequence bigint not null check (sequence >= 0),
  content_hash text not null,
  previous_chunk_hash text,
  ciphertext_ref text not null,
  remote_ref text,
  off_device_verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (incident_id, sequence)
);

alter table public.jhadina_safety_incidents enable row level security;
alter table public.jhadina_safety_personal_profiles enable row level security;
alter table public.jhadina_safety_evidence_manifest enable row level security;

-- No end-user RLS policies are created intentionally. Production access is
-- service-role/server-only behind verified identity, policy and ActionExecutor.
