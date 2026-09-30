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


create unique index if not exists music_restoration_reviews_single_approval_idx
  on public.music_restoration_reviews(case_id,artifact_id)
  where decision='approved';

create or replace function public.record_music_restoration_review(
  p_review_id text,
  p_case_id text,
  p_owner_user_id uuid,
  p_artifact_id text,
  p_comparison_artifact_id text,
  p_decision text,
  p_note text,
  p_qc_receipt_id text,
  p_qc_receipt_kind text,
  p_version_id text,
  p_reviewed_at timestamptz
)
returns jsonb
language plpgsql
set search_path=public
as $$
declare
  v_case_owner uuid;
  v_case_source text;
  v_artifact_kind text;
  v_artifact_role text;
  v_parent_artifact_id text;
  v_qc_valid boolean := false;
  v_operation text;
  v_operation_class text;
begin
  if p_decision not in ('approved','rejected') then
    raise exception 'Music restoration review decision is invalid';
  end if;

  select user_id,source_artifact_id
    into v_case_owner,v_case_source
  from public.music_restoration_cases
  where id=p_case_id
  for update;

  if v_case_owner is null or v_case_owner <> p_owner_user_id then
    raise exception 'Music restoration review owner/case mismatch';
  end if;

  select kind,role,parent_artifact_id
    into v_artifact_kind,v_artifact_role,v_parent_artifact_id
  from public.music_restoration_artifacts
  where id=p_artifact_id
    and case_id=p_case_id
    and owner_user_id=p_owner_user_id;

  if v_artifact_kind is null then
    raise exception 'Music restoration review artifact mismatch';
  end if;
  if v_artifact_kind='source' then
    raise exception 'Music restoration source cannot be promoted';
  end if;

  if p_comparison_artifact_id is not null then
    if p_comparison_artifact_id=p_artifact_id or not exists (
      select 1
      from public.music_restoration_artifacts artifact
      where artifact.id=p_comparison_artifact_id
        and artifact.case_id=p_case_id
        and artifact.owner_user_id=p_owner_user_id
    ) then
      raise exception 'Music restoration comparison artifact mismatch';
    end if;
  end if;

  if p_decision='approved' then
    if p_qc_receipt_id is null or p_qc_receipt_kind is null or p_version_id is null then
      raise exception 'Verified QC and version id are required for approval';
    end if;

    if p_qc_receipt_kind='vocal-restoration' then
      select exists (
        select 1
        from public.music_restoration_vocal_receipts receipt
        where receipt.id=p_qc_receipt_id
          and receipt.case_id=p_case_id
          and receipt.owner_user_id=p_owner_user_id
          and receipt.output_artifact_id=p_artifact_id
          and coalesce((receipt.qc->>'passed')::boolean,false)=true
      ) into v_qc_valid;
    elsif p_qc_receipt_kind='instrument-reconstruction' then
      select exists (
        select 1
        from public.music_restoration_reconstruction_receipts receipt
        where receipt.id=p_qc_receipt_id
          and receipt.case_id=p_case_id
          and receipt.owner_user_id=p_owner_user_id
          and receipt.output_artifact_id=p_artifact_id
          and coalesce((receipt.qc->>'passed')::boolean,false)=true
      ) into v_qc_valid;
    elsif p_qc_receipt_kind='restoration-execution' then
      select exists (
        select 1
        from public.music_restoration_execution_receipts receipt
        where receipt.id=p_qc_receipt_id
          and receipt.case_id=p_case_id
          and receipt.output_artifact_id=p_artifact_id
          and receipt.status='completed'
          and receipt.hash_verified=true
          and coalesce((receipt.qc->>'passed')::boolean,false)=true
      ) into v_qc_valid;
    else
      raise exception 'Music restoration QC receipt kind is invalid';
    end if;

    if not v_qc_valid then
      raise exception 'Verified QC receipt does not admit this artifact';
    end if;
  end if;

  insert into public.music_restoration_reviews(
    id,case_id,owner_user_id,artifact_id,comparison_artifact_id,
    decision,note,qc_receipt_id,qc_receipt_kind,reviewed_at
  ) values (
    p_review_id,p_case_id,p_owner_user_id,p_artifact_id,p_comparison_artifact_id,
    p_decision,nullif(btrim(p_note),''),p_qc_receipt_id,p_qc_receipt_kind,p_reviewed_at
  );

  if p_decision='approved' then
    v_operation := case
      when v_artifact_role='vocal-restoration' then 'vocal-restoration'
      when v_artifact_role like 'reconstructed-%' then 'instrument-reconstruction'
      else 'restoration-review'
    end;
    v_operation_class := case
      when v_artifact_role like 'reconstructed-%' then 'reconstruction'
      else 'correction'
    end;

    insert into public.music_restoration_versions(
      id,case_id,source_artifact_id,output_artifact_id,candidate_id,
      operation_class,operation,evidence_ids,authorization_ids,qc_passed,created_at
    ) values (
      p_version_id,p_case_id,coalesce(v_parent_artifact_id,v_case_source),p_artifact_id,p_review_id,
      v_operation_class,v_operation,array[p_review_id,p_qc_receipt_id],array[p_review_id],true,p_reviewed_at
    );

    update public.music_restoration_cases
    set current_version_id=p_version_id,status='approved',updated_at=p_reviewed_at
    where id=p_case_id and user_id=p_owner_user_id;
  end if;

  return jsonb_build_object(
    'reviewId',p_review_id,
    'decision',p_decision,
    'versionId',case when p_decision='approved' then p_version_id else null end,
    'qcReceiptId',p_qc_receipt_id,
    'qcReceiptKind',p_qc_receipt_kind
  );
end;
$$;

revoke execute on function public.record_music_restoration_review(
  text,text,uuid,text,text,text,text,text,text,text,timestamptz
) from public,anon,authenticated;
grant execute on function public.record_music_restoration_review(
  text,text,uuid,text,text,text,text,text,text,text,timestamptz
) to service_role;
