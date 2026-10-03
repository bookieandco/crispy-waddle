-- Production follow-up for OPPORTUNITY-FACTORY.FINAL evidence hardening.
-- Public experiment observations can carry arbitrary evidenceRefs, so provider
-- receipts count only deterministic IDs emitted by the trusted evidence
-- ingestion bridge. Venture outcomes are tenant-bound by owner_user_id.

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
      where payload ->> 'externalExecutionAuthorized' = 'true'
         or payload ->> 'paymentAuthorized' = 'true'
         or payload ->> 'publishingAuthorized' = 'true'
         or payload ->> 'outreachAuthorized' = 'true'
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
      where payload ->> 'automaticExternalActionAuthorized' = 'true'
    )
  )::int as n
),
copied_creative_flags as (
  select count(*)::int as n
  from public.jhadina_venture_records
  where payload #>> '{originality,directReplicationAuthorized}' = 'true'
     or payload #>> '{originality,competitorAssetReuseAuthorized}' = 'true'
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
