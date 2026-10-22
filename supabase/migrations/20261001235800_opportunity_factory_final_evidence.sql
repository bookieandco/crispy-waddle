-- OPPORTUNITY-FACTORY.FINAL production evidence + durable Venture repair receipt.
-- All collectors are source-derived and service-role only. No caller-supplied
-- booleans can self-certify live acceptance.

alter table public.jhadina_venture_runtime_receipts
  drop constraint if exists jhadina_venture_runtime_receipts_kind_check;

alter table public.jhadina_venture_runtime_receipts
  add constraint jhadina_venture_runtime_receipts_kind_check
  check (kind in (
    'market_scout',
    'supervisor',
    'supervisor_repair',
    'spatial_projection',
    'experiment_bridge',
    'outcome_bridge'
  ));

create or replace function public.jhadina_venture_supervisor_issue_repair_trusted(
  p_owner_user_id uuid,
  p_issue_id text,
  p_repair_summary text,
  p_evidence_refs text[],
  p_repaired_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue public.jhadina_venture_supervisor_issues%rowtype;
  v_receipt_id text;
  v_evidence_refs text[];
begin
  if p_owner_user_id is null then
    raise exception 'VENTURE_OWNER_REQUIRED';
  end if;
  if coalesce(btrim(p_issue_id), '') = '' then
    raise exception 'VENTURE_ISSUE_ID_REQUIRED';
  end if;
  if coalesce(btrim(p_repair_summary), '') = '' then
    raise exception 'VENTURE_REPAIR_SUMMARY_REQUIRED';
  end if;
  if p_repaired_at is null then
    raise exception 'VENTURE_REPAIRED_AT_REQUIRED';
  end if;

  select *
    into v_issue
  from public.jhadina_venture_supervisor_issues
  where owner_user_id = p_owner_user_id
    and id = p_issue_id
  for update;

  if not found then
    raise exception 'VENTURE_SUPERVISOR_ISSUE_NOT_FOUND';
  end if;

  if v_issue.recommended_action not in ('repair', 'pause', 'escalate') then
    raise exception 'VENTURE_SUPERVISOR_ISSUE_NOT_REPAIRABLE';
  end if;

  select coalesce(array_agg(distinct ref order by ref), '{}'::text[])
    into v_evidence_refs
  from unnest(coalesce(p_evidence_refs, '{}'::text[]) || array[
    'venture-supervisor-issue:' || v_issue.id
  ]) as ref
  where coalesce(btrim(ref), '') <> '';

  if cardinality(v_evidence_refs) = 0 then
    raise exception 'VENTURE_REPAIR_EVIDENCE_REQUIRED';
  end if;

  v_receipt_id := 'venture-supervisor-repair:' || v_issue.venture_id || ':' || v_issue.id;

  update public.jhadina_venture_supervisor_issues
  set resolved_at = p_repaired_at,
      updated_at = p_repaired_at
  where owner_user_id = p_owner_user_id
    and id = p_issue_id;

  insert into public.jhadina_venture_runtime_receipts (
    owner_user_id,
    id,
    venture_id,
    kind,
    evidence_refs,
    payload,
    recorded_at
  ) values (
    p_owner_user_id,
    v_receipt_id,
    v_issue.venture_id,
    'supervisor_repair',
    v_evidence_refs,
    jsonb_build_object(
      'issueId', v_issue.id,
      'ventureId', v_issue.venture_id,
      'repairSummary', btrim(p_repair_summary),
      'recommendedAction', v_issue.recommended_action,
      'automaticExternalActionAuthorized', false
    ),
    p_repaired_at
  )
  on conflict (owner_user_id, id) do update
  set evidence_refs = excluded.evidence_refs,
      payload = excluded.payload,
      recorded_at = excluded.recorded_at;

  return jsonb_build_object(
    'id', v_receipt_id,
    'ownerUserId', p_owner_user_id,
    'ventureId', v_issue.venture_id,
    'kind', 'supervisor_repair',
    'evidenceRefs', to_jsonb(v_evidence_refs),
    'payload', jsonb_build_object(
      'issueId', v_issue.id,
      'ventureId', v_issue.venture_id,
      'repairSummary', btrim(p_repair_summary),
      'recommendedAction', v_issue.recommended_action,
      'automaticExternalActionAuthorized', false
    ),
    'recordedAt', p_repaired_at
  );
end;
$$;

revoke all on function public.jhadina_venture_supervisor_issue_repair_trusted(uuid,text,text,text[],timestamptz)
  from public, anon, authenticated;
grant execute on function public.jhadina_venture_supervisor_issue_repair_trusted(uuid,text,text,text[],timestamptz)
  to service_role;

create table if not exists public.jhadina_opportunity_factory_certifications (
  id text primary key,
  source_commit text not null,
  status text not null check (status in ('pass','blocked','fail')),
  software_status text not null check (software_status in ('pass','fail')),
  live_status text not null check (live_status in ('pass','blocked','fail')),
  report jsonb not null,
  evidence jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_opportunity_factory_certifications_created_idx
  on public.jhadina_opportunity_factory_certifications(created_at desc);

alter table public.jhadina_opportunity_factory_certifications enable row level security;
revoke all on public.jhadina_opportunity_factory_certifications from public, anon, authenticated;
grant select, insert, update on public.jhadina_opportunity_factory_certifications to service_role;

create or replace function public.jhadina_opportunity_factory_live_evidence()
returns jsonb
language sql
security definer
set search_path = public
as $$
with
sam_document_notices as (
  select distinct notice_id
  from public.jhadina_sam_documents
  where source_kind <> 'notice'
    and fetch_status = 'text_captured'
    and coalesce(checksum, '') <> ''
),
sam_analysis_notices as (
  select distinct notice_id
  from public.jhadina_sam_analysis
),
sam_provider_notices as (
  select distinct p.notice_id
  from public.jhadina_sam_provider_candidates p
  where p.status <> 'blocked'
    and jsonb_typeof(p.evidence) = 'array'
    and jsonb_array_length(p.evidence) > 0
    and jsonb_typeof(p.sources) = 'array'
    and (
      select count(distinct source_name)
      from jsonb_array_elements_text(p.sources) as source_name
    ) >= 2
),
sam_pursuit_notices as (
  select distinct notice_id
  from public.jhadina_sam_pursuit_options
  where status <> 'blocked'
    and jsonb_typeof(assignments) = 'array'
    and jsonb_array_length(assignments) > 0
    and cardinality(uncovered_requirement_ids) = 0
    and jsonb_typeof(commercial) = 'object'
    and commercial ? 'status'
    and outreach_authorized = false
    and bid_submission_authorized = false
    and payment_authorized = false
    and contract_execution_authorized = false
),
sam_closed_loop as (
  select d.notice_id
  from sam_document_notices d
  join sam_analysis_notices a using (notice_id)
  join sam_provider_notices v using (notice_id)
  join sam_pursuit_notices p using (notice_id)
),
commercial_provider_observations as (
  select distinct o.id
  from public.jhadina_side_hustle_experiment_observations o
  where (
    o.id like 'side-hustle-observation:commerce:%'
    or o.id like 'side-hustle-observation:payment:%'
    or o.id like 'side-hustle-observation:fulfillment:%'
  )
    and exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(o.payload -> 'evidenceRefs') = 'array'
            then o.payload -> 'evidenceRefs'
          else '[]'::jsonb
        end
      ) as evidence_ref
      where evidence_ref like 'commerce:%'
         or evidence_ref like 'payment:%'
         or evidence_ref like 'fulfillment:%'
    )
),
trusted_commercial_outcomes as (
  select distinct o.id, o.user_id, o.opportunity_id
  from public.jhadina_opportunity_outcomes o
  where o.source_owner in ('money_core','commerce','placement')
    and jsonb_typeof(o.evidence_refs) = 'array'
    and jsonb_array_length(o.evidence_refs) > 0
    and exists (
      select 1
      from public.jhadina_side_hustle_experiments e
      where e.user_id = o.user_id
        and e.opportunity_id = o.opportunity_id
    )
),
venture_experiment_receipts as (
  select distinct r.id
  from public.jhadina_venture_runtime_receipts r
  where r.kind = 'experiment_bridge'
    and cardinality(r.evidence_refs) > 0
),
venture_outcomes as (
  select distinct o.id
  from trusted_commercial_outcomes o
  join public.jhadina_venture_records v
    on v.owner_user_id = o.user_id
   and v.opportunity_id = o.opportunity_id
),
venture_repair_receipts as (
  select distinct id
  from public.jhadina_venture_runtime_receipts
  where kind = 'supervisor_repair'
    and cardinality(evidence_refs) > 0
),
venture_spatial_receipts as (
  select distinct id
  from public.jhadina_venture_runtime_receipts
  where kind = 'spatial_projection'
    and cardinality(evidence_refs) > 0
),
sam_authority_violations as (
  select count(*)::int as n
  from public.jhadina_sam_pursuit_options
  where outreach_authorized
     or bid_submission_authorized
     or payment_authorized
     or contract_execution_authorized
),
venture_authority_violations as (
  select (
    (
      select count(*)
      from public.jhadina_venture_records
      where coalesce((payload ->> 'externalExecutionAuthorized')::boolean, false)
         or coalesce((payload ->> 'paymentAuthorized')::boolean, false)
         or coalesce((payload ->> 'publishingAuthorized')::boolean, false)
         or coalesce((payload ->> 'outreachAuthorized')::boolean, false)
    )
    +
    (
      select count(*)
      from public.jhadina_venture_work_items
      where payload ? 'authorizationEffect'
        and coalesce(payload ->> 'authorizationEffect', 'NONE') <> 'NONE'
    )
    +
    (
      select count(*)
      from public.jhadina_venture_supervisor_issues
      where coalesce((payload ->> 'automaticExternalActionAuthorized')::boolean, false)
    )
  )::int as n
),
copied_creative_flags as (
  select count(*)::int as n
  from public.jhadina_venture_records
  where coalesce((payload #>> '{originality,directReplicationAuthorized}')::boolean, false)
     or coalesce((payload #>> '{originality,competitorAssetReuseAuthorized}')::boolean, false)
)
select jsonb_build_object(
  'samClosedLoopCases', (select count(*)::int from sam_closed_loop),
  'commercialProviderReceipts', (select count(*)::int from commercial_provider_observations),
  'realizedCommercialOutcomes', (select count(*)::int from trusted_commercial_outcomes),
  'unauthorizedExternalActions',
    (select n from sam_authority_violations) + (select n from venture_authority_violations),
  'venture', jsonb_build_object(
    'discoveredSignals', (
      select count(*)::int
      from public.jhadina_venture_signal_inbox
      where active = true
    ),
    'boundedExperiments', (select count(*)::int from venture_experiment_receipts),
    'realizedCommercialOutcomes', (select count(*)::int from venture_outcomes),
    'supervisorRepairReceipts', (select count(*)::int from venture_repair_receipts),
    'spatialRuntimeReceipts', (select count(*)::int from venture_spatial_receipts),
    'unauthorizedExternalActions', (select n from venture_authority_violations),
    'copiedCreativeAssets', (select n from copied_creative_flags)
  )
);
$$;

revoke all on function public.jhadina_opportunity_factory_live_evidence()
  from public, anon, authenticated;
grant execute on function public.jhadina_opportunity_factory_live_evidence()
  to service_role;

comment on function public.jhadina_opportunity_factory_live_evidence() is
  'OPPORTUNITY-FACTORY.FINAL live evidence collector. Derives counts from canonical durable production records; accepts no caller claims.';
comment on table public.jhadina_opportunity_factory_certifications is
  'Durable OPPORTUNITY-FACTORY.FINAL certification receipts. A passing receipt is written only by the server-side certification runtime.';
