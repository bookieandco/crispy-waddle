-- SAM-SUB.21 / SAM-SUB.23 — durable governed SAM pursuit snapshots.
-- Stores the canonical Opportunity Core pursuit envelope behind authenticated
-- RLS and an optimistic-concurrency save RPC. Authenticated callers may read
-- only their own snapshots and may write only through the RPC.

create table if not exists public.jhadina_sam_pursuit_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id text not null,
  revision integer not null check (revision > 0),
  checksum text not null check (length(checksum) > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  saved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, opportunity_id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_sam_pursuit_snapshots_updated_idx
  on public.jhadina_sam_pursuit_snapshots (user_id, updated_at desc);

alter table public.jhadina_sam_pursuit_snapshots enable row level security;

drop policy if exists "jhadina_sam_pursuit_snapshots_select_own"
  on public.jhadina_sam_pursuit_snapshots;
create policy "jhadina_sam_pursuit_snapshots_select_own"
  on public.jhadina_sam_pursuit_snapshots
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.jhadina_sam_pursuit_snapshot_save(
  p_envelope jsonb,
  p_expected_revision integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_snapshot jsonb := p_envelope->'snapshot';
  v_checksum text := p_envelope->>'checksum';
  v_opportunity_id text := v_snapshot->>'opportunityId';
  v_revision integer;
  v_existing_revision integer;
  v_saved_at timestamptz;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_envelope) <> 'object' or jsonb_typeof(v_snapshot) <> 'object' then
    raise exception 'SAM pursuit envelope and snapshot must be objects';
  end if;
  if coalesce(v_opportunity_id, '') = '' then raise exception 'SAM pursuit opportunity id is required'; end if;
  if coalesce(v_checksum, '') = '' then raise exception 'SAM pursuit checksum is required'; end if;
  if coalesce((v_snapshot->>'schemaVersion')::integer, 0) <> 1 then
    raise exception 'unsupported SAM pursuit snapshot schema';
  end if;
  if coalesce((v_snapshot->>'executionAuthorized')::boolean, false) = true then
    raise exception 'SAM pursuit snapshot cannot imply execution authorization';
  end if;

  v_revision := coalesce((v_snapshot->>'revision')::integer, 0);
  if v_revision < 1 then raise exception 'SAM pursuit revision must be positive'; end if;
  v_saved_at := nullif(v_snapshot->>'savedAt', '')::timestamptz;
  if v_saved_at is null then raise exception 'SAM pursuit savedAt is required'; end if;

  perform 1
    from public.jhadina_opportunities
   where user_id = v_user
     and id = v_opportunity_id
     and opportunity_type = 'contract';
  if not found then
    raise exception 'canonical contract opportunity not found';
  end if;

  select revision
    into v_existing_revision
    from public.jhadina_sam_pursuit_snapshots
   where user_id = v_user and opportunity_id = v_opportunity_id
   for update;

  if found then
    if p_expected_revision is null or p_expected_revision <> v_existing_revision then
      raise exception 'SAM pursuit snapshot revision conflict';
    end if;
    if v_revision <> v_existing_revision + 1 then
      raise exception 'SAM pursuit snapshot revision must increment by one';
    end if;

    update public.jhadina_sam_pursuit_snapshots
       set revision = v_revision,
           checksum = v_checksum,
           snapshot = v_snapshot,
           saved_at = v_saved_at,
           updated_at = now()
     where user_id = v_user and opportunity_id = v_opportunity_id;
  else
    if p_expected_revision is not null then
      raise exception 'SAM pursuit snapshot revision conflict';
    end if;
    if v_revision <> 1 then
      raise exception 'initial SAM pursuit snapshot revision must be one';
    end if;

    insert into public.jhadina_sam_pursuit_snapshots (
      user_id, opportunity_id, revision, checksum, snapshot, saved_at
    ) values (
      v_user, v_opportunity_id, v_revision, v_checksum, v_snapshot, v_saved_at
    );
  end if;

  return jsonb_build_object(
    'snapshot', v_snapshot,
    'checksum', v_checksum
  );
end;
$$;

revoke all on function public.jhadina_sam_pursuit_snapshot_save(jsonb, integer) from public;
grant execute on function public.jhadina_sam_pursuit_snapshot_save(jsonb, integer) to authenticated;
