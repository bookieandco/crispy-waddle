create or replace function public.jhadina_growth_record_creative_experiment(
  p_experiment_key text, p_brand_id text, p_name text, p_control_variant_id text,
  p_treatment_variant_ids jsonb, p_mutation_axis text, p_hypotheses jsonb, p_plan jsonb,
  p_request_fingerprint text, p_idempotency_key text, p_status text default 'planned'
)
returns public.jhadina_growth_creative_experiments
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.record_creative_experiment(
    p_experiment_key,p_brand_id,p_name,p_control_variant_id,p_treatment_variant_ids,
    p_mutation_axis,p_hypotheses,p_plan,p_request_fingerprint,p_idempotency_key,p_status
  )
$$;

create or replace function public.jhadina_growth_record_creative_variant_lineage(
  p_experiment_id uuid, p_variant_id text, p_content_project_id text, p_concept_id text, p_platform text,
  p_product_identity_ref text, p_style_identity_ref text, p_mutation_axis text, p_mutation_ref text,
  p_control_variant_id text, p_fixed_dimension_refs jsonb, p_director_project_id text, p_director_artifact_id text,
  p_artifact_sha256 text, p_director_stage_id text, p_director_stage_version integer, p_review_decision_id text,
  p_evidence_refs jsonb, p_lineage_fingerprint text, p_lineage jsonb
)
returns public.jhadina_growth_creative_variant_lineage
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.record_creative_variant_lineage(
    p_experiment_id,p_variant_id,p_content_project_id,p_concept_id,p_platform,
    p_product_identity_ref,p_style_identity_ref,p_mutation_axis,p_mutation_ref,p_control_variant_id,
    p_fixed_dimension_refs,p_director_project_id,p_director_artifact_id,p_artifact_sha256,
    p_director_stage_id,p_director_stage_version,p_review_decision_id,p_evidence_refs,p_lineage_fingerprint,p_lineage
  )
$$;

create or replace function public.jhadina_growth_record_creative_experiment_observation(
  p_experiment_id uuid, p_variant_id text, p_observation_key text, p_observation_fingerprint text,
  p_exposures bigint, p_clicks bigint, p_conversions bigint, p_payments bigint,
  p_spend numeric, p_contribution_margin numeric, p_observed_at timestamptz, p_evidence_refs jsonb
)
returns public.jhadina_growth_creative_experiment_observations
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.record_creative_experiment_observation(
    p_experiment_id,p_variant_id,p_observation_key,p_observation_fingerprint,
    p_exposures,p_clicks,p_conversions,p_payments,p_spend,p_contribution_margin,p_observed_at,p_evidence_refs
  )
$$;

create or replace function public.jhadina_growth_record_evidence_health_assessment(
  p_experiment_id uuid, p_assessment_key text, p_assessment_fingerprint text, p_source text, p_asset_ref text,
  p_checked_at timestamptz, p_age_seconds integer, p_freshness text, p_completeness numeric, p_monitor_coverage numeric,
  p_active_incident_count integer, p_upstream_issue_count integer, p_schema_anomaly boolean, p_volume_anomaly boolean,
  p_lineage_complete boolean, p_severity text, p_allowed_for_learning boolean, p_blockers jsonb, p_warnings jsonb,
  p_evidence_refs jsonb, p_assessment jsonb
)
returns public.jhadina_growth_evidence_health_assessments
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.record_evidence_health_assessment(
    p_experiment_id,p_assessment_key,p_assessment_fingerprint,p_source,p_asset_ref,
    p_checked_at,p_age_seconds,p_freshness,p_completeness,p_monitor_coverage,
    p_active_incident_count,p_upstream_issue_count,p_schema_anomaly,p_volume_anomaly,p_lineage_complete,
    p_severity,p_allowed_for_learning,p_blockers,p_warnings,p_evidence_refs,p_assessment
  )
$$;

create or replace function public.jhadina_growth_record_creative_experiment_assessment(
  p_experiment_id uuid, p_assessment_key text, p_assessment_fingerprint text,
  p_control_variant_id text, p_treatment_variant_id text, p_control_rate numeric, p_treatment_rate numeric,
  p_absolute_lift numeric, p_relative_lift numeric, p_z_score numeric, p_p_value numeric,
  p_confidence_interval95 jsonb, p_incremental_contribution numeric, p_incremental_contribution_per_exposure numeric,
  p_evidence_refs jsonb, p_status text, p_decision text, p_health_assessment_id uuid, p_assessed_at timestamptz,
  p_assessment jsonb
)
returns public.jhadina_growth_creative_experiment_assessments
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.record_creative_experiment_assessment(
    p_experiment_id,p_assessment_key,p_assessment_fingerprint,p_control_variant_id,p_treatment_variant_id,
    p_control_rate,p_treatment_rate,p_absolute_lift,p_relative_lift,p_z_score,p_p_value,p_confidence_interval95,
    p_incremental_contribution,p_incremental_contribution_per_exposure,p_evidence_refs,p_status,p_decision,
    p_health_assessment_id,p_assessed_at,p_assessment
  )
$$;

create or replace function public.jhadina_growth_set_creative_experiment_status(
  p_experiment_id uuid, p_expected_status text, p_status text
)
returns public.jhadina_growth_creative_experiments
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.set_creative_experiment_status(
    p_experiment_id,p_expected_status,p_status
  )
$$;

revoke execute on function public.jhadina_growth_record_creative_experiment(text,text,text,text,jsonb,text,jsonb,jsonb,text,text,text) from public, anon;
revoke execute on function public.jhadina_growth_record_creative_variant_lineage(uuid,text,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,integer,text,jsonb,text,jsonb) from public, anon;
revoke execute on function public.jhadina_growth_record_creative_experiment_observation(uuid,text,text,text,bigint,bigint,bigint,bigint,numeric,numeric,timestamptz,jsonb) from public, anon;
revoke execute on function public.jhadina_growth_record_evidence_health_assessment(uuid,text,text,text,text,timestamptz,integer,text,numeric,numeric,integer,integer,boolean,boolean,boolean,text,boolean,jsonb,jsonb,jsonb,jsonb) from public, anon;
revoke execute on function public.jhadina_growth_record_creative_experiment_assessment(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,jsonb,numeric,numeric,jsonb,text,text,uuid,timestamptz,jsonb) from public, anon;
revoke execute on function public.jhadina_growth_set_creative_experiment_status(uuid,text,text) from public, anon;

grant execute on function public.jhadina_growth_record_creative_experiment(text,text,text,text,jsonb,text,jsonb,jsonb,text,text,text) to authenticated;
grant execute on function public.jhadina_growth_record_creative_variant_lineage(uuid,text,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,integer,text,jsonb,text,jsonb) to authenticated;
grant execute on function public.jhadina_growth_record_creative_experiment_observation(uuid,text,text,text,bigint,bigint,bigint,bigint,numeric,numeric,timestamptz,jsonb) to authenticated;
grant execute on function public.jhadina_growth_record_evidence_health_assessment(uuid,text,text,text,text,timestamptz,integer,text,numeric,numeric,integer,integer,boolean,boolean,boolean,text,boolean,jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.jhadina_growth_record_creative_experiment_assessment(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,jsonb,numeric,numeric,jsonb,text,text,uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.jhadina_growth_set_creative_experiment_status(uuid,text,text) to authenticated;

create or replace function public.jhadina_growth_creative_experiment_runtime_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion','ASK-GROWTH.2-v1',
    'ready',
      to_regclass('public.jhadina_growth_creative_experiments') is not null
      and to_regclass('public.jhadina_growth_creative_variant_lineage') is not null
      and to_regclass('public.jhadina_growth_creative_experiment_observations') is not null
      and to_regclass('public.jhadina_growth_evidence_health_assessments') is not null
      and to_regclass('public.jhadina_growth_creative_experiment_assessments') is not null,
    'learningAuthorityOnly', true,
    'ownerReadPoliciesReady',
      exists(select 1 from pg_policies where schemaname='public' and tablename='jhadina_growth_creative_experiments' and policyname='growth_owner_read_creative_experiments')
      and exists(select 1 from pg_policies where schemaname='public' and tablename='jhadina_growth_creative_variant_lineage' and policyname='growth_owner_read_creative_variant_lineage')
      and exists(select 1 from pg_policies where schemaname='public' and tablename='jhadina_growth_creative_experiment_observations' and policyname='growth_owner_read_creative_experiment_observations')
      and exists(select 1 from pg_policies where schemaname='public' and tablename='jhadina_growth_evidence_health_assessments' and policyname='growth_owner_read_evidence_health_assessments')
      and exists(select 1 from pg_policies where schemaname='public' and tablename='jhadina_growth_creative_experiment_assessments' and policyname='growth_owner_read_creative_experiment_assessments')
  )
$$;

revoke execute on function public.jhadina_growth_creative_experiment_runtime_health() from public, anon;
grant execute on function public.jhadina_growth_creative_experiment_runtime_health() to authenticated;
