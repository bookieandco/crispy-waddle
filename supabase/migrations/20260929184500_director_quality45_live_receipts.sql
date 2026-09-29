create table if not exists public.director_live_take_qc_receipts (
  id text primary key,
  project_id text not null,
  character_id text not null,
  purpose text not null check(purpose in ('quality4-canary','quality5-stress')),
  reference_asset_id text not null references public.director_reference_media_assets(id) on delete restrict,
  reference_sha256 text not null check(reference_sha256 ~ '^[0-9a-f]{64}$'),
  audio_asset_id text not null references public.director_generated_editing_assets(id) on delete restrict,
  voice_identity_id text not null references public.director_voice_identities(id) on delete restrict,
  speaker_fingerprint_receipt_id text not null references public.director_speaker_fingerprint_receipts(id) on delete restrict,
  speaker_fingerprint_ref text not null,
  provider_id text not null,
  model_id text not null,
  model_version text not null,
  provider_job_id text not null,
  provider_runtime_receipt_id text not null,
  seed integer not null check(seed >= 0),
  output_asset_id text not null references public.director_generated_editing_assets(id) on delete restrict,
  output_sha256 text not null check(output_sha256 ~ '^[0-9a-f]{64}$'),
  content_type text not null check(content_type like 'video/%'),
  measured_duration_seconds numeric not null check(measured_duration_seconds >= 5 and measured_duration_seconds <= 10),
  storage_verified boolean not null,
  production_provider boolean not null,
  performance_evidence jsonb not null,
  observations jsonb not null,
  qc_policy_id text not null,
  qc_admissible boolean not null,
  expected_failure_observed boolean not null default false,
  qc_reasons text[] not null default '{}',
  evidence_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(project_id,purpose,provider_job_id)
);

create table if not exists public.director_quality5_localized_repair_receipts (
  id text primary key,
  project_id text not null,
  character_id text not null,
  failure_take_receipt_id text not null references public.director_live_take_qc_receipts(id) on delete restrict,
  source_asset_id text not null references public.director_generated_editing_assets(id) on delete restrict,
  source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
  repaired_asset_id text not null references public.director_generated_editing_assets(id) on delete restrict,
  repaired_sha256 text not null check(repaired_sha256 ~ '^[0-9a-f]{64}$'),
  provider_id text not null,
  model_id text not null,
  model_version text not null,
  provider_job_id text not null,
  provider_runtime_receipt_id text not null,
  repair_plan jsonb not null,
  post_repair_observations jsonb not null,
  preservation_evidence jsonb not null,
  repair_duration_seconds numeric not null check(repair_duration_seconds > 0),
  qc_admissible boolean not null,
  qc_reasons text[] not null default '{}',
  evidence_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(project_id,failure_take_receipt_id)
);

create or replace function public.assert_director_live_take_qc_receipt()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  ref_row public.director_reference_media_assets%rowtype;
  audio_row public.director_generated_editing_assets%rowtype;
  output_row public.director_generated_editing_assets%rowtype;
  voice_row public.director_voice_identities%rowtype;
  fp_row public.director_speaker_fingerprint_receipts%rowtype;
begin
  select * into ref_row from public.director_reference_media_assets where id=new.reference_asset_id;
  if not found or ref_row.project_id<>new.project_id or ref_row.sha256<>new.reference_sha256
     or ref_row.admission_status<>'admitted' or ref_row.scan_status<>'clean' then
    raise exception 'Director live take reference authority mismatch';
  end if;

  select * into audio_row from public.director_generated_editing_assets where id=new.audio_asset_id;
  if not found or audio_row.project_id<>new.project_id or audio_row.media_type<>'audio' then
    raise exception 'Director live take audio authority mismatch';
  end if;

  select * into output_row from public.director_generated_editing_assets where id=new.output_asset_id;
  if not found or output_row.project_id<>new.project_id or output_row.media_type<>'video'
     or output_row.sha256<>new.output_sha256 or output_row.provider_id<>new.provider_id
     or coalesce(output_row.model_id,'')<>new.model_id then
    raise exception 'Director live take output authority mismatch';
  end if;

  select * into voice_row from public.director_voice_identities where id=new.voice_identity_id;
  if not found or voice_row.project_id<>new.project_id or voice_row.character_id<>new.character_id
     or not (new.speaker_fingerprint_ref=any(voice_row.speaker_fingerprint_refs)) then
    raise exception 'Director live take voice authority mismatch';
  end if;

  select * into fp_row from public.director_speaker_fingerprint_receipts where id=new.speaker_fingerprint_receipt_id;
  if not found or fp_row.project_id<>new.project_id or fp_row.character_id<>new.character_id
     or fp_row.fingerprint_ref<>new.speaker_fingerprint_ref then
    raise exception 'Director live take speaker fingerprint mismatch';
  end if;

  if not new.storage_verified or not new.production_provider then
    raise exception 'Director live take requires verified production media';
  end if;
  if new.purpose='quality4-canary' and not new.qc_admissible then
    raise exception 'Director QUALITY.4 receipt must represent a passed independent QC review';
  end if;
  if new.purpose='quality5-stress' and (new.qc_admissible or not new.expected_failure_observed) then
    raise exception 'Director QUALITY.5 stress receipt must preserve a real observed failure';
  end if;
  return new;
end;
$$;

drop trigger if exists director_live_take_qc_receipt_guard on public.director_live_take_qc_receipts;
create trigger director_live_take_qc_receipt_guard
before insert on public.director_live_take_qc_receipts
for each row execute function public.assert_director_live_take_qc_receipt();

create or replace function public.assert_director_quality5_localized_repair_receipt()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  failure_row public.director_live_take_qc_receipts%rowtype;
  source_row public.director_generated_editing_assets%rowtype;
  repaired_row public.director_generated_editing_assets%rowtype;
begin
  select * into failure_row from public.director_live_take_qc_receipts where id=new.failure_take_receipt_id;
  if not found or failure_row.project_id<>new.project_id or failure_row.character_id<>new.character_id
     or failure_row.purpose<>'quality5-stress' or failure_row.qc_admissible
     or not failure_row.expected_failure_observed then
    raise exception 'Director QUALITY.5 repair requires a real failed stress take';
  end if;

  select * into source_row from public.director_generated_editing_assets where id=new.source_asset_id;
  if not found or source_row.id<>failure_row.output_asset_id or source_row.sha256<>new.source_sha256 then
    raise exception 'Director QUALITY.5 repair source mismatch';
  end if;

  select * into repaired_row from public.director_generated_editing_assets where id=new.repaired_asset_id;
  if not found or repaired_row.project_id<>new.project_id or repaired_row.media_type<>'video'
     or repaired_row.sha256<>new.repaired_sha256 or repaired_row.provider_id<>new.provider_id
     or coalesce(repaired_row.model_id,'')<>new.model_id then
    raise exception 'Director QUALITY.5 repaired output authority mismatch';
  end if;

  if new.source_sha256=new.repaired_sha256 or not new.qc_admissible then
    raise exception 'Director QUALITY.5 localized repair must change bytes and pass post-repair QC';
  end if;
  return new;
end;
$$;

drop trigger if exists director_quality5_localized_repair_guard on public.director_quality5_localized_repair_receipts;
create trigger director_quality5_localized_repair_guard
before insert on public.director_quality5_localized_repair_receipts
for each row execute function public.assert_director_quality5_localized_repair_receipt();

create or replace function public.reject_director_quality_receipt_mutation()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  raise exception 'Director live quality receipts are append-only';
end;
$$;

drop trigger if exists director_live_take_qc_receipts_immutable on public.director_live_take_qc_receipts;
create trigger director_live_take_qc_receipts_immutable
before update or delete on public.director_live_take_qc_receipts
for each row execute function public.reject_director_quality_receipt_mutation();

drop trigger if exists director_quality5_localized_repair_receipts_immutable on public.director_quality5_localized_repair_receipts;
create trigger director_quality5_localized_repair_receipts_immutable
before update or delete on public.director_quality5_localized_repair_receipts
for each row execute function public.reject_director_quality_receipt_mutation();

alter table public.director_live_take_qc_receipts enable row level security;
alter table public.director_quality5_localized_repair_receipts enable row level security;

revoke all on public.director_live_take_qc_receipts from public,anon,authenticated;
revoke all on public.director_quality5_localized_repair_receipts from public,anon,authenticated;
grant select,insert on public.director_live_take_qc_receipts to service_role;
grant select,insert on public.director_quality5_localized_repair_receipts to service_role;

drop policy if exists director_live_take_qc_receipts_service_role_only on public.director_live_take_qc_receipts;
create policy director_live_take_qc_receipts_service_role_only
on public.director_live_take_qc_receipts as restrictive for all to service_role using(true) with check(true);

drop policy if exists director_quality5_localized_repair_receipts_service_role_only on public.director_quality5_localized_repair_receipts;
create policy director_quality5_localized_repair_receipts_service_role_only
on public.director_quality5_localized_repair_receipts as restrictive for all to service_role using(true) with check(true);

create index if not exists director_live_take_qc_receipts_lookup_idx
on public.director_live_take_qc_receipts(project_id,character_id,purpose,created_at desc);

create index if not exists director_quality5_localized_repair_receipts_lookup_idx
on public.director_quality5_localized_repair_receipts(project_id,character_id,created_at desc);

comment on table public.director_live_take_qc_receipts is
'Append-only independent QC receipts for real Director live takes. Renderer output never self-certifies. QUALITY.4 requires a passed canary; QUALITY.5 stress requires an actual observed failed take.';

comment on table public.director_quality5_localized_repair_receipts is
'Append-only proof that a real failed Director stress take was repaired only in a localized region and independently passed post-repair QC while approved work survived.';
