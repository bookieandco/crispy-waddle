-- TRANSCRIPT-FOLD.RUNTIME.1
-- Durable evidence state for commercial learning, prospect intelligence, and
-- Social publish-canary receipts. These tables grant no execution authority.

create table if not exists public.jhadina_commercial_learning_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  kind text not null check (kind in (
    'offer_canvas',
    'validation_test',
    'market_learning',
    'proof_sprint',
    'recurring_offer_assessment'
  )),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_commercial_learning_opportunity_idx
  on public.jhadina_commercial_learning_records
  (user_id, opportunity_id, kind, recorded_at desc);

create table if not exists public.jhadina_prospect_icps (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.jhadina_prospects (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  icp_id text not null,
  contact_quality text not null check (contact_quality in (
    'generic_business',
    'public_professional',
    'verified_professional',
    'inferred_professional',
    'personal_or_unverified'
  )),
  suppression_state text not null check (suppression_state in (
    'clear',
    'contacted',
    'declined',
    'do_not_contact',
    'suppressed',
    'customer'
  )),
  last_verified_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, icp_id)
    references public.jhadina_prospect_icps(user_id, id) on delete cascade
);

create index if not exists jhadina_prospects_icp_idx
  on public.jhadina_prospects
  (user_id, icp_id, suppression_state, last_verified_at desc);

create table if not exists public.jhadina_social_publish_canaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  asset_id text not null,
  canary_platform text not null,
  expansion_platforms jsonb not null default '[]'::jsonb
    check (jsonb_typeof(expansion_platforms) = 'array'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.jhadina_social_platform_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  canary_plan_id text not null,
  asset_id text not null,
  outbox_id uuid not null references public.jhadina_social_outbox(id) on delete cascade,
  account_id uuid not null references public.jhadina_social_accounts(id) on delete cascade,
  provider text not null,
  platform text not null,
  provider_post_id text,
  final_url text,
  state text not null check (state in ('submitted','published','failed','unknown')),
  observed_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_refs) = 'array'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, canary_plan_id, outbox_id),
  foreign key (user_id, canary_plan_id)
    references public.jhadina_social_publish_canaries(user_id, id) on delete cascade
);

create index if not exists jhadina_social_platform_receipts_plan_idx
  on public.jhadina_social_platform_receipts
  (user_id, canary_plan_id, observed_at desc);

alter table public.jhadina_commercial_learning_records enable row level security;
alter table public.jhadina_prospect_icps enable row level security;
alter table public.jhadina_prospects enable row level security;
alter table public.jhadina_social_publish_canaries enable row level security;
alter table public.jhadina_social_platform_receipts enable row level security;

drop policy if exists "jhadina_commercial_learning_select_own"
  on public.jhadina_commercial_learning_records;
create policy "jhadina_commercial_learning_select_own"
  on public.jhadina_commercial_learning_records
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "jhadina_prospect_icps_select_own"
  on public.jhadina_prospect_icps;
create policy "jhadina_prospect_icps_select_own"
  on public.jhadina_prospect_icps
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "jhadina_prospects_select_own"
  on public.jhadina_prospects;
create policy "jhadina_prospects_select_own"
  on public.jhadina_prospects
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "jhadina_social_publish_canaries_select_own"
  on public.jhadina_social_publish_canaries;
create policy "jhadina_social_publish_canaries_select_own"
  on public.jhadina_social_publish_canaries
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "jhadina_social_platform_receipts_select_own"
  on public.jhadina_social_platform_receipts;
create policy "jhadina_social_platform_receipts_select_own"
  on public.jhadina_social_platform_receipts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.jhadina_commercial_learning_upsert(
  p_record jsonb
)
returns public.jhadina_commercial_learning_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_record->>'id';
  v_opportunity_id text := p_record->>'opportunityId';
  v_kind text := p_record->>'kind';
  v_payload jsonb := p_record->'payload';
  v_recorded_at timestamptz;
  v_result public.jhadina_commercial_learning_records;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_record) <> 'object' then raise exception 'commercial record must be an object'; end if;
  if coalesce(v_id,'') = '' or coalesce(v_opportunity_id,'') = '' then
    raise exception 'commercial record id and opportunity id are required';
  end if;
  if v_kind not in ('offer_canvas','validation_test','market_learning','proof_sprint','recurring_offer_assessment') then
    raise exception 'commercial record kind is invalid';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then raise exception 'commercial record payload must be an object'; end if;
  v_recorded_at := nullif(p_record->>'recordedAt','')::timestamptz;
  if v_recorded_at is null then raise exception 'commercial record recordedAt is required'; end if;

  if not exists (
    select 1 from public.jhadina_opportunities
    where user_id = v_user and id = v_opportunity_id
  ) then
    raise exception 'opportunity not found';
  end if;

  insert into public.jhadina_commercial_learning_records (
    user_id, id, opportunity_id, kind, payload, recorded_at
  ) values (
    v_user, v_id, v_opportunity_id, v_kind, v_payload, v_recorded_at
  )
  on conflict (user_id, id) do update
    set payload = excluded.payload,
        recorded_at = excluded.recorded_at,
        updated_at = now()
    where jhadina_commercial_learning_records.opportunity_id = excluded.opportunity_id
      and jhadina_commercial_learning_records.kind = excluded.kind
  returning * into v_result;

  if v_result.id is null then raise exception 'commercial record idempotency conflict'; end if;
  return v_result;
end;
$$;

create or replace function public.jhadina_prospect_icp_upsert(
  p_icp jsonb
)
returns public.jhadina_prospect_icps
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_icp->>'id';
  v_created_at timestamptz;
  v_result public.jhadina_prospect_icps;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_icp) <> 'object' then raise exception 'ICP must be an object'; end if;
  if coalesce(v_id,'') = '' then raise exception 'ICP id is required'; end if;
  if coalesce(p_icp->>'authority','') <> 'ANALYSIS_ONLY' then raise exception 'ICP authority must be ANALYSIS_ONLY'; end if;
  if jsonb_typeof(p_icp->'evidenceRefs') <> 'array'
     or jsonb_array_length(p_icp->'evidenceRefs') = 0 then
    raise exception 'ICP evidence is required';
  end if;
  v_created_at := nullif(p_icp->>'createdAt','')::timestamptz;
  if v_created_at is null then raise exception 'ICP createdAt is required'; end if;

  insert into public.jhadina_prospect_icps (user_id, id, payload, created_at)
  values (v_user, v_id, p_icp, v_created_at)
  on conflict (user_id, id) do update
    set payload = excluded.payload,
        updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.jhadina_prospect_upsert(
  p_prospect jsonb
)
returns public.jhadina_prospects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_prospect->>'id';
  v_icp_id text := p_prospect->>'icpId';
  v_contact_quality text := p_prospect->>'contactQuality';
  v_suppression_state text := p_prospect->>'suppressionState';
  v_last_verified_at timestamptz;
  v_result public.jhadina_prospects;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_prospect) <> 'object' then raise exception 'prospect must be an object'; end if;
  if coalesce(v_id,'') = '' or coalesce(v_icp_id,'') = '' then raise exception 'prospect id and ICP id are required'; end if;
  if v_contact_quality not in (
    'generic_business','public_professional','verified_professional',
    'inferred_professional','personal_or_unverified'
  ) then raise exception 'prospect contact quality is invalid'; end if;
  if v_suppression_state not in (
    'clear','contacted','declined','do_not_contact','suppressed','customer'
  ) then raise exception 'prospect suppression state is invalid'; end if;
  if coalesce(p_prospect->>'authority','') <> 'RESEARCH_ONLY' then
    raise exception 'prospect authority must be RESEARCH_ONLY';
  end if;
  if coalesce((p_prospect->>'outreachAuthorized')::boolean, true) is not false then
    raise exception 'prospect record cannot grant outreach authority';
  end if;
  if jsonb_typeof(p_prospect->'evidence') <> 'array'
     or jsonb_array_length(p_prospect->'evidence') = 0 then
    raise exception 'prospect evidence is required';
  end if;
  v_last_verified_at := nullif(p_prospect->>'lastVerifiedAt','')::timestamptz;
  if v_last_verified_at is null then raise exception 'prospect lastVerifiedAt is required'; end if;

  if not exists (
    select 1 from public.jhadina_prospect_icps
    where user_id = v_user and id = v_icp_id
  ) then
    raise exception 'prospect ICP not found';
  end if;

  insert into public.jhadina_prospects (
    user_id, id, icp_id, contact_quality, suppression_state,
    last_verified_at, payload
  ) values (
    v_user, v_id, v_icp_id, v_contact_quality, v_suppression_state,
    v_last_verified_at, p_prospect
  )
  on conflict (user_id, id) do update
    set icp_id = excluded.icp_id,
        contact_quality = excluded.contact_quality,
        suppression_state = excluded.suppression_state,
        last_verified_at = excluded.last_verified_at,
        payload = excluded.payload,
        updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.jhadina_social_publish_canary_create(
  p_plan jsonb
)
returns public.jhadina_social_publish_canaries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id text := p_plan->>'id';
  v_asset_id text := p_plan->>'assetId';
  v_canary_platform text := p_plan->>'canaryPlatform';
  v_expansion_platforms jsonb := coalesce(p_plan->'expansionPlatforms','[]'::jsonb);
  v_created_at timestamptz;
  v_result public.jhadina_social_publish_canaries;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_plan) <> 'object' then raise exception 'publish canary plan must be an object'; end if;
  if coalesce(v_id,'') = '' or coalesce(v_asset_id,'') = '' or coalesce(v_canary_platform,'') = '' then
    raise exception 'publish canary id, asset, and platform are required';
  end if;
  if coalesce(p_plan->>'authority','') <> 'PLANNING_ONLY' then
    raise exception 'publish canary authority must be PLANNING_ONLY';
  end if;
  if jsonb_typeof(v_expansion_platforms) <> 'array' then
    raise exception 'publish canary expansion platforms must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_expansion_platforms) as platform
    where platform = v_canary_platform
  ) then
    raise exception 'canary platform cannot also be an expansion platform';
  end if;
  v_created_at := nullif(p_plan->>'createdAt','')::timestamptz;
  if v_created_at is null then raise exception 'publish canary createdAt is required'; end if;

  insert into public.jhadina_social_publish_canaries (
    user_id, id, asset_id, canary_platform, expansion_platforms, payload, created_at
  ) values (
    v_user, v_id, v_asset_id, v_canary_platform, v_expansion_platforms, p_plan, v_created_at
  )
  on conflict (user_id, id) do update
    set asset_id = excluded.asset_id,
        canary_platform = excluded.canary_platform,
        expansion_platforms = excluded.expansion_platforms,
        payload = excluded.payload,
        updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.jhadina_social_publish_canary_capture_outbox(
  p_canary_plan_id text,
  p_outbox_id uuid,
  p_final_url text default null
)
returns public.jhadina_social_platform_receipts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.jhadina_social_publish_canaries%rowtype;
  v_outbox public.jhadina_social_outbox%rowtype;
  v_state text;
  v_id text;
  v_evidence jsonb;
  v_payload jsonb;
  v_result public.jhadina_social_platform_receipts;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if coalesce(p_canary_plan_id,'') = '' then raise exception 'publish canary plan id is required'; end if;

  select * into v_plan
  from public.jhadina_social_publish_canaries
  where user_id = v_user and id = p_canary_plan_id;

  if not found then raise exception 'publish canary plan not found'; end if;

  select * into v_outbox
  from public.jhadina_social_outbox
  where user_id = v_user and id = p_outbox_id;

  if not found then raise exception 'social outbox job not found'; end if;
  if v_outbox.platform <> v_plan.canary_platform then
    raise exception 'social outbox platform does not match canary platform';
  end if;

  v_state := case v_outbox.status
    when 'delivered' then 'published'
    when 'failed' then 'failed'
    when 'cancelled' then 'failed'
    when 'ambiguous' then 'unknown'
    else 'submitted'
  end;

  if v_state = 'published' and coalesce(v_outbox.provider_post_id,'') = '' then
    raise exception 'published outbox requires provider post id';
  end if;

  v_id := v_plan.id || ':outbox:' || v_outbox.id::text;
  v_evidence := jsonb_build_array('social-outbox:' || v_outbox.id::text);
  v_payload := jsonb_build_object(
    'id', v_id,
    'canaryPlanId', v_plan.id,
    'assetId', v_plan.asset_id,
    'platform', v_outbox.platform,
    'accountId', v_outbox.account_id::text,
    'provider', v_outbox.provider,
    'providerPostId', v_outbox.provider_post_id,
    'finalUrl', nullif(trim(p_final_url),''),
    'state', v_state,
    'captionVersion', v_outbox.proposal_id::text,
    'assetVersion', v_plan.asset_id,
    'observedAt', now(),
    'evidenceRefs', v_evidence
  );

  insert into public.jhadina_social_platform_receipts (
    user_id, id, canary_plan_id, asset_id, outbox_id, account_id,
    provider, platform, provider_post_id, final_url, state,
    observed_at, evidence_refs, payload
  ) values (
    v_user, v_id, v_plan.id, v_plan.asset_id, v_outbox.id, v_outbox.account_id,
    v_outbox.provider, v_outbox.platform, v_outbox.provider_post_id,
    nullif(trim(p_final_url),''), v_state, now(), v_evidence, v_payload
  )
  on conflict (user_id, canary_plan_id, outbox_id) do update
    set provider_post_id = excluded.provider_post_id,
        final_url = excluded.final_url,
        state = excluded.state,
        observed_at = excluded.observed_at,
        evidence_refs = excluded.evidence_refs,
        payload = excluded.payload
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on table public.jhadina_commercial_learning_records from anon, authenticated;
revoke all on table public.jhadina_prospect_icps from anon, authenticated;
revoke all on table public.jhadina_prospects from anon, authenticated;
revoke all on table public.jhadina_social_publish_canaries from anon, authenticated;
revoke all on table public.jhadina_social_platform_receipts from anon, authenticated;

grant select on table public.jhadina_commercial_learning_records to authenticated;
grant select on table public.jhadina_prospect_icps to authenticated;
grant select on table public.jhadina_prospects to authenticated;
grant select on table public.jhadina_social_publish_canaries to authenticated;
grant select on table public.jhadina_social_platform_receipts to authenticated;

grant all on table public.jhadina_commercial_learning_records to service_role;
grant all on table public.jhadina_prospect_icps to service_role;
grant all on table public.jhadina_prospects to service_role;
grant all on table public.jhadina_social_publish_canaries to service_role;
grant all on table public.jhadina_social_platform_receipts to service_role;

revoke all on function public.jhadina_commercial_learning_upsert(jsonb) from public, anon;
revoke all on function public.jhadina_prospect_icp_upsert(jsonb) from public, anon;
revoke all on function public.jhadina_prospect_upsert(jsonb) from public, anon;
revoke all on function public.jhadina_social_publish_canary_create(jsonb) from public, anon;
revoke all on function public.jhadina_social_publish_canary_capture_outbox(text,uuid,text) from public, anon;

grant execute on function public.jhadina_commercial_learning_upsert(jsonb) to authenticated, service_role;
grant execute on function public.jhadina_prospect_icp_upsert(jsonb) to authenticated, service_role;
grant execute on function public.jhadina_prospect_upsert(jsonb) to authenticated, service_role;
grant execute on function public.jhadina_social_publish_canary_create(jsonb) to authenticated, service_role;
grant execute on function public.jhadina_social_publish_canary_capture_outbox(text,uuid,text) to authenticated, service_role;
