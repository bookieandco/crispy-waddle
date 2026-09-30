-- MUSIC-RESTORE.FINAL durable real-song certification receipts.

create table if not exists public.music_restoration_final_certifications (
  id text primary key,
  case_id text not null references public.music_restoration_cases(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_artifact_id text not null references public.music_restoration_artifacts(id) on delete restrict,
  current_version_id text not null references public.music_restoration_versions(id) on delete restrict,
  output_artifact_id text not null references public.music_restoration_artifacts(id) on delete restrict,
  bundle_sha256 text not null,
  verified_artifacts jsonb not null,
  runtime_health jsonb not null,
  evidence jsonb not null,
  certified_at timestamptz not null default now(),
  check (source_artifact_id <> output_artifact_id),
  check (bundle_sha256 ~ '^[0-9a-f]{64}$'),
  unique (case_id,current_version_id)
);

create index if not exists music_restoration_final_owner_idx
  on public.music_restoration_final_certifications(owner_user_id,certified_at desc);
create index if not exists music_restoration_final_output_idx
  on public.music_restoration_final_certifications(output_artifact_id);

create or replace function public.assert_music_restoration_final_certification()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_case_owner uuid;
  v_case_source text;
  v_case_current_version text;
  v_version_output text;
  v_version_candidate text;
  v_version_qc boolean;
  v_source_hash text;
  v_output_hash text;
  v_failed_check_count integer;
  v_required_check_count integer;
begin
  select user_id,source_artifact_id,current_version_id
    into v_case_owner,v_case_source,v_case_current_version
  from public.music_restoration_cases
  where id=new.case_id;

  if v_case_owner is null or v_case_owner <> new.owner_user_id then
    raise exception 'Music final certification owner/case mismatch';
  end if;
  if v_case_source <> new.source_artifact_id then
    raise exception 'Music final certification source mismatch';
  end if;
  if v_case_current_version is distinct from new.current_version_id then
    raise exception 'Music final certification is not for current version';
  end if;

  select output_artifact_id,candidate_id,qc_passed
    into v_version_output,v_version_candidate,v_version_qc
  from public.music_restoration_versions
  where id=new.current_version_id
    and case_id=new.case_id;

  if v_version_output is null or v_version_output <> new.output_artifact_id or v_version_qc is not true then
    raise exception 'Music final certification version/output/QC mismatch';
  end if;

  if not exists (
    select 1
    from public.music_restoration_artifacts artifact
    where artifact.id=new.source_artifact_id
      and artifact.case_id=new.case_id
      and artifact.owner_user_id=new.owner_user_id
      and artifact.kind='source'
  ) then
    raise exception 'Music final certification immutable source lineage mismatch';
  end if;

  if not exists (
    select 1
    from public.music_restoration_artifacts artifact
    where artifact.id=new.output_artifact_id
      and artifact.case_id=new.case_id
      and artifact.owner_user_id=new.owner_user_id
  ) then
    raise exception 'Music final certification output lineage mismatch';
  end if;

  if coalesce((new.runtime_health->>'productionReady')::boolean,false) is not true then
    raise exception 'Music final certification runtime is not production ready';
  end if;

  if jsonb_typeof(new.verified_artifacts) <> 'array'
     or jsonb_array_length(new.verified_artifacts) = 0 then
    raise exception 'Music final certification verified artifact list is empty';
  end if;

  select content_hash into v_source_hash
  from public.music_restoration_artifacts
  where id=new.source_artifact_id
    and case_id=new.case_id
    and owner_user_id=new.owner_user_id;

  select content_hash into v_output_hash
  from public.music_restoration_artifacts
  where id=new.output_artifact_id
    and case_id=new.case_id
    and owner_user_id=new.owner_user_id;

  if not exists (
    select 1
    from jsonb_array_elements(new.verified_artifacts) item
    where item->>'artifactId'=new.source_artifact_id
      and lower(item->>'sha256')=lower(v_source_hash)
  ) then
    raise exception 'Music final certification source hash proof missing';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(new.verified_artifacts) item
    where item->>'artifactId'=new.output_artifact_id
      and lower(item->>'sha256')=lower(v_output_hash)
  ) then
    raise exception 'Music final certification output hash proof missing';
  end if;

  if jsonb_typeof(new.evidence->'checks') is distinct from 'array'
     or jsonb_array_length(new.evidence->'checks') <> 10 then
    raise exception 'Music final certification check evidence is incomplete';
  end if;

  select count(*) into v_failed_check_count
  from jsonb_array_elements(new.evidence->'checks') item
  where coalesce((item->>'passed')::boolean,false) is not true;

  if v_failed_check_count <> 0 then
    raise exception 'Music final certification contains blocked checks';
  end if;

  select count(distinct item->>'id') into v_required_check_count
  from jsonb_array_elements(new.evidence->'checks') item
  where item->>'id' in (
    'runtime-ready',
    'immutable-source',
    'separation-receipt',
    'perception-receipts',
    'consequential-repair',
    'human-review',
    'current-version',
    'qc-receipt',
    'artifact-hashes',
    'daw-bundle'
  )
    and coalesce((item->>'passed')::boolean,false) is true;

  if v_required_check_count <> 10 then
    raise exception 'Music final certification required checks are incomplete';
  end if;

  if not exists (
    select 1
    from public.music_restoration_reviews review
    where review.id=v_version_candidate
      and review.case_id=new.case_id
      and review.owner_user_id=new.owner_user_id
      and review.artifact_id=new.output_artifact_id
      and review.decision='approved'
  ) then
    raise exception 'Music final certification human approval missing';
  end if;

  return new;
end;
$$;

drop trigger if exists music_restoration_final_certification_guard
  on public.music_restoration_final_certifications;
create trigger music_restoration_final_certification_guard
before insert or update on public.music_restoration_final_certifications
for each row execute function public.assert_music_restoration_final_certification();

alter table public.music_restoration_final_certifications enable row level security;
alter table public.music_restoration_final_certifications force row level security;

revoke all on public.music_restoration_final_certifications
  from public,anon,authenticated,service_role;
grant select,insert on public.music_restoration_final_certifications to service_role;

revoke execute on function public.assert_music_restoration_final_certification()
  from public,anon,authenticated;
grant execute on function public.assert_music_restoration_final_certification()
  to service_role;

drop policy if exists music_restoration_final_service_role_only
  on public.music_restoration_final_certifications;
create policy music_restoration_final_service_role_only
  on public.music_restoration_final_certifications
  as restrictive for all to service_role
  using(true) with check(true);
