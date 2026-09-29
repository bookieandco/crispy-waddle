create table if not exists public.director_voice_identity_approval_receipts (
  id text primary key,
  project_id text not null,
  character_id text not null,
  voice_identity_id text not null references public.director_voice_identities(id) on delete cascade,
  candidate_asset_id text not null,
  candidate_sha256 text not null,
  candidate_receipt_id text not null,
  speaker_fingerprint_receipt_id text not null,
  speaker_fingerprint_ref text not null,
  minimum_speaker_similarity numeric not null check(minimum_speaker_similarity > 0 and minimum_speaker_similarity <= 1),
  provider text not null,
  model_id text not null,
  provider_voice_ref text,
  authority text not null check(authority='DIRECTOR_EXPLICIT_VOICE_APPROVAL'),
  evidence_ids text[] not null default '{}',
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(project_id,character_id,voice_identity_id)
);

alter table public.director_voice_identity_approval_receipts enable row level security;
revoke all on public.director_voice_identity_approval_receipts from public,anon,authenticated;
grant select,insert,update,delete on public.director_voice_identity_approval_receipts to service_role;

drop policy if exists director_voice_identity_approval_receipts_service_role_only
  on public.director_voice_identity_approval_receipts;
create policy director_voice_identity_approval_receipts_service_role_only
  on public.director_voice_identity_approval_receipts
  for all to service_role using (true) with check (true);

create index if not exists director_voice_identity_approval_receipts_project_character_idx
  on public.director_voice_identity_approval_receipts(project_id,character_id,approved_at desc);

comment on table public.director_voice_identity_approval_receipts is
'Explicit human approval receipts binding a Director voice identity to an exact candidate audio SHA, acoustic fingerprint and provider provenance. Presence is required by Bonez QUALITY.3 preflight; generation/QC evidence alone never auto-approves a voice.';
