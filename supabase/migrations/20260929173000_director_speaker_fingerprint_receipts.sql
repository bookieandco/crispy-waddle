create table if not exists public.director_speaker_fingerprint_receipts (
  id text primary key,
  project_id text not null,
  character_id text not null,
  source_asset_id text not null,
  source_sha256 text not null,
  normalized_audio_sha256 text not null,
  model_id text not null,
  model_revision text not null,
  embedding_dimensions integer not null check(embedding_dimensions > 0),
  embedding_sha256 text not null,
  fingerprint_ref text not null,
  quantization text not null,
  sample_rate_hz integer not null check(sample_rate_hz >= 8000),
  duration_seconds numeric not null check(duration_seconds > 0),
  quality_claim boolean not null default false,
  evidence_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(project_id,character_id,source_sha256,model_id,model_revision),
  unique(fingerprint_ref)
);

alter table public.director_speaker_fingerprint_receipts enable row level security;
revoke all on public.director_speaker_fingerprint_receipts from public,anon,authenticated;
grant select,insert,update,delete on public.director_speaker_fingerprint_receipts to service_role;

drop policy if exists director_speaker_fingerprint_receipts_service_role_only
  on public.director_speaker_fingerprint_receipts;
create policy director_speaker_fingerprint_receipts_service_role_only
  on public.director_speaker_fingerprint_receipts
  for all to service_role using (true) with check (true);

create index if not exists director_speaker_fingerprint_project_character_idx
  on public.director_speaker_fingerprint_receipts(project_id,character_id,created_at desc);

comment on table public.director_speaker_fingerprint_receipts is
'Provider-independent acoustic speaker fingerprint receipts. Raw embeddings are intentionally not persisted; fingerprint_ref binds a pinned model revision to the quantized embedding SHA-256.';
