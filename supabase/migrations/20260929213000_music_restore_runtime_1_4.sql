-- MUSIC-RESTORE.1-.4 durable restoration metadata and private audio bucket.
create table if not exists public.music_restoration_cases (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  status text not null default 'open'
    check (status in ('open','analyzing','planned','processing','qc','approved','rejected')),
  source_artifact_id text not null,
  source_version_id text not null,
  current_version_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.music_restoration_artifacts (
  id text primary key,
  case_id text not null references public.music_restoration_cases(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('source','derived','reconstructed','synthetic','external')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  sample_rate integer not null check (sample_rate > 0 and sample_rate <= 384000),
  channels integer not null check (channels > 0 and channels <= 32),
  sample_count bigint not null check (sample_count >= 0),
  parent_artifact_id text references public.music_restoration_artifacts(id) on delete restrict,
  storage_bucket text not null default 'jhadina-music-restoration',
  storage_path text not null,
  mime_type text not null check (mime_type like 'audio/%'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 524288000),
  role text,
  runtime_receipt_id text,
  created_at timestamptz not null default now(),
  unique(storage_bucket,storage_path)
);

alter table public.music_restoration_cases
  drop constraint if exists music_restoration_cases_source_artifact_fk;
alter table public.music_restoration_cases
  add constraint music_restoration_cases_source_artifact_fk
  foreign key(source_artifact_id) references public.music_restoration_artifacts(id)
  deferrable initially deferred;

create table if not exists public.music_restoration_evidence (
  id text primary key,
  case_id text not null references public.music_restoration_cases(id) on delete restrict,
  artifact_id text not null references public.music_restoration_artifacts(id) on delete restrict,
  kind text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  region jsonb,
  data jsonb not null default '{}'::jsonb,
  runtime_receipt_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.music_restoration_jobs (
  id text primary key,
  case_id text not null references public.music_restoration_cases(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('probe','separate','perceive','repair')),
  status text not null check (status in ('queued','processing','completed','failed','cancelled')),
  source_artifact_id text not null references public.music_restoration_artifacts(id) on delete restrict,
  output_artifact_ids text[] not null default '{}',
  runtime_receipt_id text,
  metadata jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists music_restoration_cases_user_idx
  on public.music_restoration_cases(user_id,created_at desc);
create index if not exists music_restoration_artifacts_case_idx
  on public.music_restoration_artifacts(case_id,created_at);
create index if not exists music_restoration_evidence_artifact_idx
  on public.music_restoration_evidence(artifact_id,created_at);
create index if not exists music_restoration_jobs_case_status_idx
  on public.music_restoration_jobs(case_id,status,updated_at);

create or replace function public.assert_music_restoration_artifact_owner()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  case_owner uuid;
begin
  select user_id into case_owner from public.music_restoration_cases where id=new.case_id;
  if case_owner is null or case_owner <> new.owner_user_id then
    raise exception 'Music restoration artifact owner/case mismatch';
  end if;
  if new.parent_artifact_id is not null and not exists (
    select 1 from public.music_restoration_artifacts parent
    where parent.id=new.parent_artifact_id
      and parent.case_id=new.case_id
      and parent.owner_user_id=new.owner_user_id
  ) then
    raise exception 'Music restoration artifact parent lineage mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists music_restoration_artifact_owner_guard on public.music_restoration_artifacts;
create trigger music_restoration_artifact_owner_guard
before insert or update on public.music_restoration_artifacts
for each row execute function public.assert_music_restoration_artifact_owner();

create or replace function public.assert_music_restoration_job_owner()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  case_owner uuid;
begin
  select user_id into case_owner from public.music_restoration_cases where id=new.case_id;
  if case_owner is null or case_owner <> new.owner_user_id then
    raise exception 'Music restoration job owner/case mismatch';
  end if;
  if not exists (
    select 1 from public.music_restoration_artifacts artifact
    where artifact.id=new.source_artifact_id
      and artifact.case_id=new.case_id
      and artifact.owner_user_id=new.owner_user_id
  ) then
    raise exception 'Music restoration job source mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists music_restoration_job_owner_guard on public.music_restoration_jobs;
create trigger music_restoration_job_owner_guard
before insert or update on public.music_restoration_jobs
for each row execute function public.assert_music_restoration_job_owner();

alter table public.music_restoration_cases enable row level security;
alter table public.music_restoration_cases force row level security;
alter table public.music_restoration_artifacts enable row level security;
alter table public.music_restoration_artifacts force row level security;
alter table public.music_restoration_evidence enable row level security;
alter table public.music_restoration_evidence force row level security;
alter table public.music_restoration_jobs enable row level security;
alter table public.music_restoration_jobs force row level security;

revoke all on public.music_restoration_cases from public,anon,authenticated;
revoke all on public.music_restoration_artifacts from public,anon,authenticated;
revoke all on public.music_restoration_evidence from public,anon,authenticated;
revoke all on public.music_restoration_jobs from public,anon,authenticated;

grant select,insert,update on public.music_restoration_cases to service_role;
grant select,insert on public.music_restoration_artifacts to service_role;
grant select,insert on public.music_restoration_evidence to service_role;
grant select,insert,update on public.music_restoration_jobs to service_role;

drop policy if exists music_restoration_cases_service_role_only on public.music_restoration_cases;
create policy music_restoration_cases_service_role_only
  on public.music_restoration_cases as restrictive for all to service_role using(true) with check(true);
drop policy if exists music_restoration_artifacts_service_role_only on public.music_restoration_artifacts;
create policy music_restoration_artifacts_service_role_only
  on public.music_restoration_artifacts as restrictive for all to service_role using(true) with check(true);
drop policy if exists music_restoration_evidence_service_role_only on public.music_restoration_evidence;
create policy music_restoration_evidence_service_role_only
  on public.music_restoration_evidence as restrictive for all to service_role using(true) with check(true);
drop policy if exists music_restoration_jobs_service_role_only on public.music_restoration_jobs;
create policy music_restoration_jobs_service_role_only
  on public.music_restoration_jobs as restrictive for all to service_role using(true) with check(true);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'jhadina-music-restoration','jhadina-music-restoration',false,524288000,
  array['audio/wav','audio/x-wav','audio/flac','audio/mpeg','audio/mp4','audio/aac','audio/ogg']
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

-- No anon/authenticated storage.objects policies are admitted. Audio access is
-- service-role only and workers receive short-lived signed URLs.
