create table if not exists public.director_voice_candidate_receipts (
  id text primary key,
  project_id text not null,
  character_id text not null,
  provider text not null,
  provider_task_id text not null,
  model_id text not null,
  provider_voice_ref text not null,
  primary_language text not null,
  speed numeric,
  duration_seconds numeric not null,
  prompt_label text not null,
  transcript text,
  receipt_sha256 text not null,
  artifact_sha256 text,
  approval_state text not null default 'candidate_unapproved'
    check (approval_state in ('candidate_unapproved','approved','rejected')),
  artifact_hash_status text not null default 'pending_binary_retrieval'
    check (artifact_hash_status in ('pending_binary_retrieval','verified')),
  provenance_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_task_id),
  unique(receipt_sha256)
);

alter table public.director_voice_candidate_receipts enable row level security;
revoke all on public.director_voice_candidate_receipts from public,anon,authenticated;
grant select,insert,update,delete on public.director_voice_candidate_receipts to service_role;

drop policy if exists director_voice_candidate_receipts_service_role_only
  on public.director_voice_candidate_receipts;
create policy director_voice_candidate_receipts_service_role_only
  on public.director_voice_candidate_receipts
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists director_voice_candidate_receipts_project_character_idx
  on public.director_voice_candidate_receipts(project_id,character_id,created_at desc);

comment on table public.director_voice_candidate_receipts is
'Unapproved Director voice audition/provider receipts. Presence here never constitutes an approved director_voice_identity; artifact_sha256 remains null until the actual audio bytes are retrieved and hashed.';
