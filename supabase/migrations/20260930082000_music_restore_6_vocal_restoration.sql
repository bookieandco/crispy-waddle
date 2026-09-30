-- MUSIC-RESTORE.6 deterministic vocal-restoration receipts.

alter table public.music_restoration_jobs
  drop constraint if exists music_restoration_jobs_kind_check;
alter table public.music_restoration_jobs
  add constraint music_restoration_jobs_kind_check
  check (kind in ('probe','separate','perceive','repair','reconstruct','vocal-restore'));

create table if not exists public.music_restoration_vocal_receipts (
  id text primary key,
  job_id text not null unique references public.music_restoration_jobs(id) on delete restrict,
  case_id text not null references public.music_restoration_cases(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_artifact_id text not null references public.music_restoration_artifacts(id) on delete restrict,
  output_artifact_id text not null references public.music_restoration_artifacts(id) on delete restrict,
  segments jsonb not null,
  evidence_ids text[] not null default '{}',
  approval_evidence_id text not null,
  approved_by_user_id uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null,
  runtime_receipt_id text not null,
  preservation jsonb not null,
  qc jsonb not null,
  created_at timestamptz not null default now(),
  check (source_artifact_id <> output_artifact_id),
  check (approved_by_user_id = owner_user_id)
);

create index if not exists music_restoration_vocal_case_idx
  on public.music_restoration_vocal_receipts(case_id,created_at);
create index if not exists music_restoration_vocal_owner_idx
  on public.music_restoration_vocal_receipts(owner_user_id);
create index if not exists music_restoration_vocal_source_idx
  on public.music_restoration_vocal_receipts(source_artifact_id);
create index if not exists music_restoration_vocal_output_idx
  on public.music_restoration_vocal_receipts(output_artifact_id);

create or replace function public.assert_music_restoration_vocal_receipt_owner()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  case_owner uuid;
begin
  select user_id into case_owner
  from public.music_restoration_cases
  where id=new.case_id;

  if case_owner is null or case_owner <> new.owner_user_id then
    raise exception 'Music vocal restoration receipt owner/case mismatch';
  end if;

  if not exists (
    select 1
    from public.music_restoration_artifacts artifact
    where artifact.id=new.source_artifact_id
      and artifact.case_id=new.case_id
      and artifact.owner_user_id=new.owner_user_id
  ) then
    raise exception 'Music vocal restoration source lineage mismatch';
  end if;

  if not exists (
    select 1
    from public.music_restoration_artifacts artifact
    where artifact.id=new.output_artifact_id
      and artifact.case_id=new.case_id
      and artifact.owner_user_id=new.owner_user_id
      and artifact.parent_artifact_id=new.source_artifact_id
  ) then
    raise exception 'Music vocal restoration output lineage mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists music_restoration_vocal_receipt_owner_guard
  on public.music_restoration_vocal_receipts;
create trigger music_restoration_vocal_receipt_owner_guard
before insert or update on public.music_restoration_vocal_receipts
for each row execute function public.assert_music_restoration_vocal_receipt_owner();

alter table public.music_restoration_vocal_receipts enable row level security;
alter table public.music_restoration_vocal_receipts force row level security;

revoke all on public.music_restoration_vocal_receipts from public,anon,authenticated,service_role;
grant select,insert on public.music_restoration_vocal_receipts to service_role;

revoke execute on function public.assert_music_restoration_vocal_receipt_owner()
  from public,anon,authenticated;
grant execute on function public.assert_music_restoration_vocal_receipt_owner()
  to service_role;

drop policy if exists music_restoration_vocal_service_role_only
  on public.music_restoration_vocal_receipts;
create policy music_restoration_vocal_service_role_only
  on public.music_restoration_vocal_receipts
  as restrictive for all to service_role
  using(true) with check(true);
