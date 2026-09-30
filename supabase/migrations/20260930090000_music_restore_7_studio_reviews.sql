-- MUSIC-RESTORE.7 durable Restoration Studio review decisions.

create table if not exists public.music_restoration_reviews (
  id text primary key,
  case_id text not null references public.music_restoration_cases(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  artifact_id text not null references public.music_restoration_artifacts(id) on delete restrict,
  comparison_artifact_id text references public.music_restoration_artifacts(id) on delete restrict,
  decision text not null check (decision in ('approved','rejected')),
  note text,
  qc_receipt_id text,
  qc_receipt_kind text,
  reviewed_at timestamptz not null default now(),
  check (comparison_artifact_id is null or comparison_artifact_id <> artifact_id),
  check (
    decision <> 'approved'
    or (qc_receipt_id is not null and qc_receipt_kind is not null)
  )
);

create index if not exists music_restoration_reviews_case_idx
  on public.music_restoration_reviews(case_id,reviewed_at);
create index if not exists music_restoration_reviews_owner_idx
  on public.music_restoration_reviews(owner_user_id);
create index if not exists music_restoration_reviews_artifact_idx
  on public.music_restoration_reviews(artifact_id);
create index if not exists music_restoration_reviews_comparison_idx
  on public.music_restoration_reviews(comparison_artifact_id)
  where comparison_artifact_id is not null;

create or replace function public.assert_music_restoration_review_owner()
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
    raise exception 'Music restoration review owner/case mismatch';
  end if;

  if not exists (
    select 1
    from public.music_restoration_artifacts artifact
    where artifact.id=new.artifact_id
      and artifact.case_id=new.case_id
      and artifact.owner_user_id=new.owner_user_id
  ) then
    raise exception 'Music restoration review artifact mismatch';
  end if;

  if new.comparison_artifact_id is not null and not exists (
    select 1
    from public.music_restoration_artifacts artifact
    where artifact.id=new.comparison_artifact_id
      and artifact.case_id=new.case_id
      and artifact.owner_user_id=new.owner_user_id
  ) then
    raise exception 'Music restoration review comparison artifact mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists music_restoration_review_owner_guard
  on public.music_restoration_reviews;
create trigger music_restoration_review_owner_guard
before insert or update on public.music_restoration_reviews
for each row execute function public.assert_music_restoration_review_owner();

alter table public.music_restoration_reviews enable row level security;
alter table public.music_restoration_reviews force row level security;

revoke all on public.music_restoration_reviews from public,anon,authenticated,service_role;
grant select,insert on public.music_restoration_reviews to service_role;

revoke execute on function public.assert_music_restoration_review_owner()
  from public,anon,authenticated;
grant execute on function public.assert_music_restoration_review_owner()
  to service_role;

drop policy if exists music_restoration_reviews_service_role_only
  on public.music_restoration_reviews;
create policy music_restoration_reviews_service_role_only
  on public.music_restoration_reviews
  as restrictive for all to service_role
  using(true) with check(true);
