create table public.jhadina_growth_creative_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experiment_key text not null,
  brand_id text not null,
  name text not null,
  control_variant_id text not null,
  treatment_variant_ids jsonb not null check (jsonb_typeof(treatment_variant_ids)='array' and jsonb_array_length(treatment_variant_ids) > 0),
  mutation_axis text not null check (mutation_axis in ('net_new_concept','hook','opening_shot','product_variant','character','cta','platform_format','visual_treatment','landing_message')),
  hypotheses jsonb not null check (jsonb_typeof(hypotheses)='object'),
  plan jsonb not null check (jsonb_typeof(plan)='object'),
  status text not null default 'planned' check (status in ('planned','running','paused','completed','cancelled')),
  authority text not null default 'LEARNING_PLAN_ONLY' check (authority='LEARNING_PLAN_ONLY'),
  request_fingerprint text not null,
  idempotency_key text not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, experiment_key),
  unique(user_id, idempotency_key)
);

create table public.jhadina_growth_creative_variant_lineage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experiment_id uuid not null references public.jhadina_growth_creative_experiments(id) on delete cascade,
  variant_id text not null,
  content_project_id text not null,
  concept_id text not null,
  platform text not null check (platform in ('facebook','instagram','tiktok','youtube','reddit','linkedin','other')),
  product_identity_ref text not null,
  style_identity_ref text not null,
  mutation_axis text not null check (mutation_axis in ('net_new_concept','hook','opening_shot','product_variant','character','cta','platform_format','visual_treatment','landing_message')),
  mutation_ref text not null,
  control_variant_id text,
  fixed_dimension_refs jsonb not null check (jsonb_typeof(fixed_dimension_refs)='object'),
  director_project_id text not null,
  director_artifact_id text not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  director_stage_id text,
  director_stage_version integer check (director_stage_version is null or director_stage_version >= 1),
  review_decision_id text,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array' and jsonb_array_length(evidence_refs) > 0),
  lineage_fingerprint text not null,
  lineage jsonb not null check (jsonb_typeof(lineage)='object'),
  authority text not null default 'EXPERIMENT_INPUT_ONLY' check (authority='EXPERIMENT_INPUT_ONLY'),
  created_at timestamptz not null default now(),
  unique(experiment_id, variant_id)
);

create table public.jhadina_growth_creative_experiment_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experiment_id uuid not null references public.jhadina_growth_creative_experiments(id) on delete cascade,
  variant_id text not null,
  observation_key text not null,
  observation_fingerprint text not null,
  exposures bigint not null check (exposures >= 0),
  clicks bigint check (clicks is null or (clicks >= 0 and clicks <= exposures)),
  conversions bigint not null check (conversions >= 0 and conversions <= exposures),
  payments bigint check (payments is null or (payments >= 0 and payments <= conversions)),
  spend numeric not null check (spend >= 0),
  contribution_margin numeric not null,
  observed_at timestamptz not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array' and jsonb_array_length(evidence_refs) > 0),
  created_at timestamptz not null default now(),
  unique(user_id, observation_key)
);

create table public.jhadina_growth_evidence_health_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experiment_id uuid references public.jhadina_growth_creative_experiments(id) on delete set null,
  assessment_key text not null,
  assessment_fingerprint text not null,
  source text not null,
  asset_ref text not null,
  checked_at timestamptz not null,
  age_seconds integer not null check (age_seconds >= 0),
  freshness text not null check (freshness in ('fresh','stale')),
  completeness numeric not null check (completeness >= 0 and completeness <= 1),
  monitor_coverage numeric not null check (monitor_coverage >= 0 and monitor_coverage <= 1),
  active_incident_count integer not null check (active_incident_count >= 0),
  upstream_issue_count integer not null check (upstream_issue_count >= 0),
  schema_anomaly boolean not null,
  volume_anomaly boolean not null,
  lineage_complete boolean not null,
  severity text not null check (severity in ('healthy','degraded','blocked')),
  allowed_for_learning boolean not null,
  blockers jsonb not null check (jsonb_typeof(blockers)='array'),
  warnings jsonb not null check (jsonb_typeof(warnings)='array'),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array' and jsonb_array_length(evidence_refs) > 0),
  assessment jsonb not null check (jsonb_typeof(assessment)='object'),
  created_at timestamptz not null default now(),
  unique(user_id, assessment_key),
  check ((severity='blocked' and allowed_for_learning=false) or (severity in ('healthy','degraded') and allowed_for_learning=true))
);

create table public.jhadina_growth_creative_experiment_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experiment_id uuid not null references public.jhadina_growth_creative_experiments(id) on delete cascade,
  assessment_key text not null,
  assessment_fingerprint text not null,
  control_variant_id text not null,
  treatment_variant_id text not null,
  control_rate numeric not null check (control_rate >= 0 and control_rate <= 1),
  treatment_rate numeric not null check (treatment_rate >= 0 and treatment_rate <= 1),
  absolute_lift numeric not null,
  relative_lift numeric,
  z_score numeric,
  p_value numeric check (p_value is null or (p_value >= 0 and p_value <= 1)),
  confidence_interval95 jsonb,
  incremental_contribution numeric not null,
  incremental_contribution_per_exposure numeric not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array' and jsonb_array_length(evidence_refs) > 0),
  status text not null check (status in ('insufficient_evidence','inconclusive','statistically_supported','statistically_supported_but_economically_weak','treatment_underperformed')),
  decision text not null check (decision in ('keep_collecting','preserve_control','promote_treatment_for_next_test','do_not_scale_treatment')),
  health_assessment_id uuid references public.jhadina_growth_evidence_health_assessments(id) on delete set null,
  authority text not null default 'LEARNING_ONLY' check (authority='LEARNING_ONLY'),
  assessed_at timestamptz not null,
  assessment jsonb not null check (jsonb_typeof(assessment)='object'),
  created_at timestamptz not null default now(),
  unique(user_id, assessment_key)
);

create index jhadina_growth_creative_experiments_owner_idx
  on public.jhadina_growth_creative_experiments(user_id, status, updated_at desc);
create index jhadina_growth_variant_lineage_owner_idx
  on public.jhadina_growth_creative_variant_lineage(user_id, experiment_id, created_at);
create index jhadina_growth_experiment_observations_owner_idx
  on public.jhadina_growth_creative_experiment_observations(user_id, experiment_id, observed_at desc);
create index jhadina_growth_evidence_health_owner_idx
  on public.jhadina_growth_evidence_health_assessments(user_id, experiment_id, checked_at desc);
create index jhadina_growth_experiment_assessments_owner_idx
  on public.jhadina_growth_creative_experiment_assessments(user_id, experiment_id, assessed_at desc);

alter table public.jhadina_growth_creative_experiments enable row level security;
alter table public.jhadina_growth_creative_variant_lineage enable row level security;
alter table public.jhadina_growth_creative_experiment_observations enable row level security;
alter table public.jhadina_growth_evidence_health_assessments enable row level security;
alter table public.jhadina_growth_creative_experiment_assessments enable row level security;

revoke all on table
  public.jhadina_growth_creative_experiments,
  public.jhadina_growth_creative_variant_lineage,
  public.jhadina_growth_creative_experiment_observations,
  public.jhadina_growth_evidence_health_assessments,
  public.jhadina_growth_creative_experiment_assessments
from anon, authenticated;

grant select on table
  public.jhadina_growth_creative_experiments,
  public.jhadina_growth_creative_variant_lineage,
  public.jhadina_growth_creative_experiment_observations,
  public.jhadina_growth_evidence_health_assessments,
  public.jhadina_growth_creative_experiment_assessments
to authenticated;

create policy growth_owner_read_creative_experiments
  on public.jhadina_growth_creative_experiments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy growth_owner_read_creative_variant_lineage
  on public.jhadina_growth_creative_variant_lineage for select to authenticated
  using ((select auth.uid()) = user_id);
create policy growth_owner_read_creative_experiment_observations
  on public.jhadina_growth_creative_experiment_observations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy growth_owner_read_evidence_health_assessments
  on public.jhadina_growth_evidence_health_assessments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy growth_owner_read_creative_experiment_assessments
  on public.jhadina_growth_creative_experiment_assessments for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function growth_private.record_creative_experiment(
  p_experiment_key text, p_brand_id text, p_name text, p_control_variant_id text,
  p_treatment_variant_ids jsonb, p_mutation_axis text, p_hypotheses jsonb, p_plan jsonb,
  p_request_fingerprint text, p_idempotency_key text, p_status text default 'planned'
)
returns public.jhadina_growth_creative_experiments
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_row public.jhadina_growth_creative_experiments;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_experiment_key),'') is null or nullif(trim(p_brand_id),'') is null
    or nullif(trim(p_name),'') is null or nullif(trim(p_control_variant_id),'') is null
    or nullif(trim(p_request_fingerprint),'') is null or nullif(trim(p_idempotency_key),'') is null
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_REQUIRED_FIELDS_MISSING'; end if;
  if p_mutation_axis not in ('net_new_concept','hook','opening_shot','product_variant','character','cta','platform_format','visual_treatment','landing_message')
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_MUTATION_AXIS_INVALID'; end if;
  if p_status not in ('planned','running','paused','completed','cancelled')
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_STATUS_INVALID'; end if;
  if jsonb_typeof(p_treatment_variant_ids) <> 'array' or jsonb_array_length(p_treatment_variant_ids)=0
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_TREATMENTS_REQUIRED'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_treatment_variant_ids) v where trim(v)=trim(p_control_variant_id))
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_CONTROL_IN_TREATMENTS'; end if;
  if jsonb_array_length(p_treatment_variant_ids) <> (select count(distinct value) from jsonb_array_elements_text(p_treatment_variant_ids))
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_DUPLICATE_TREATMENT'; end if;
  if jsonb_typeof(p_hypotheses) <> 'object' or jsonb_typeof(p_plan) <> 'object'
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_JSON_INVALID'; end if;

  select * into v_row from public.jhadina_growth_creative_experiments
  where user_id=v_user and idempotency_key=p_idempotency_key;
  if v_row.id is not null then
    if v_row.request_fingerprint <> p_request_fingerprint then raise exception 'GROWTH_IDEMPOTENCY_CONFLICT'; end if;
    return v_row;
  end if;

  insert into public.jhadina_growth_creative_experiments(
    user_id,experiment_key,brand_id,name,control_variant_id,treatment_variant_ids,mutation_axis,
    hypotheses,plan,status,request_fingerprint,idempotency_key,started_at,completed_at
  ) values (
    v_user,trim(p_experiment_key),trim(p_brand_id),trim(p_name),trim(p_control_variant_id),
    p_treatment_variant_ids,p_mutation_axis,p_hypotheses,p_plan,p_status,p_request_fingerprint,p_idempotency_key,
    case when p_status='running' then now() else null end,
    case when p_status='completed' then now() else null end
  ) returning * into v_row;
  return v_row;
end $$;

create or replace function growth_private.record_creative_variant_lineage(
  p_experiment_id uuid, p_variant_id text, p_content_project_id text, p_concept_id text, p_platform text,
  p_product_identity_ref text, p_style_identity_ref text, p_mutation_axis text, p_mutation_ref text,
  p_control_variant_id text, p_fixed_dimension_refs jsonb, p_director_project_id text, p_director_artifact_id text,
  p_artifact_sha256 text, p_director_stage_id text, p_director_stage_version integer, p_review_decision_id text,
  p_evidence_refs jsonb, p_lineage_fingerprint text, p_lineage jsonb
)
returns public.jhadina_growth_creative_variant_lineage
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_row public.jhadina_growth_creative_variant_lineage;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_growth_creative_experiments where id=p_experiment_id and user_id=v_user)
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_NOT_FOUND'; end if;
  if nullif(trim(p_variant_id),'') is null or nullif(trim(p_content_project_id),'') is null
    or nullif(trim(p_concept_id),'') is null or nullif(trim(p_product_identity_ref),'') is null
    or nullif(trim(p_style_identity_ref),'') is null or nullif(trim(p_mutation_ref),'') is null
    or nullif(trim(p_director_project_id),'') is null or nullif(trim(p_director_artifact_id),'') is null
    or nullif(trim(p_lineage_fingerprint),'') is null
  then raise exception 'GROWTH_CREATIVE_VARIANT_REQUIRED_FIELDS_MISSING'; end if;
  if p_platform not in ('facebook','instagram','tiktok','youtube','reddit','linkedin','other')
  then raise exception 'GROWTH_CREATIVE_VARIANT_PLATFORM_INVALID'; end if;
  if p_mutation_axis not in ('net_new_concept','hook','opening_shot','product_variant','character','cta','platform_format','visual_treatment','landing_message')
  then raise exception 'GROWTH_CREATIVE_VARIANT_MUTATION_AXIS_INVALID'; end if;
  if p_artifact_sha256 !~ '^[A-Fa-f0-9]{64}$' then raise exception 'GROWTH_CREATIVE_VARIANT_SHA256_INVALID'; end if;
  if p_director_stage_version is not null and p_director_stage_version < 1 then raise exception 'GROWTH_CREATIVE_VARIANT_STAGE_VERSION_INVALID'; end if;
  if jsonb_typeof(p_fixed_dimension_refs) <> 'object' or jsonb_typeof(p_evidence_refs) <> 'array'
    or jsonb_array_length(p_evidence_refs)=0 or jsonb_typeof(p_lineage) <> 'object'
  then raise exception 'GROWTH_CREATIVE_VARIANT_JSON_INVALID'; end if;

  select * into v_row from public.jhadina_growth_creative_variant_lineage
  where experiment_id=p_experiment_id and variant_id=p_variant_id;
  if v_row.id is not null then
    if v_row.user_id <> v_user or v_row.lineage_fingerprint <> p_lineage_fingerprint
    then raise exception 'GROWTH_IDEMPOTENCY_CONFLICT'; end if;
    return v_row;
  end if;

  insert into public.jhadina_growth_creative_variant_lineage(
    user_id,experiment_id,variant_id,content_project_id,concept_id,platform,product_identity_ref,style_identity_ref,
    mutation_axis,mutation_ref,control_variant_id,fixed_dimension_refs,director_project_id,director_artifact_id,
    artifact_sha256,director_stage_id,director_stage_version,review_decision_id,evidence_refs,lineage_fingerprint,lineage
  ) values (
    v_user,p_experiment_id,trim(p_variant_id),trim(p_content_project_id),trim(p_concept_id),p_platform,
    trim(p_product_identity_ref),trim(p_style_identity_ref),p_mutation_axis,trim(p_mutation_ref),p_control_variant_id,
    p_fixed_dimension_refs,trim(p_director_project_id),trim(p_director_artifact_id),lower(p_artifact_sha256),
    p_director_stage_id,p_director_stage_version,p_review_decision_id,p_evidence_refs,p_lineage_fingerprint,p_lineage
  ) returning * into v_row;
  return v_row;
end $$;

create or replace function growth_private.record_creative_experiment_observation(
  p_experiment_id uuid, p_variant_id text, p_observation_key text, p_observation_fingerprint text,
  p_exposures bigint, p_clicks bigint, p_conversions bigint, p_payments bigint,
  p_spend numeric, p_contribution_margin numeric, p_observed_at timestamptz, p_evidence_refs jsonb
)
returns public.jhadina_growth_creative_experiment_observations
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_row public.jhadina_growth_creative_experiment_observations;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_variant_id),'') is null or nullif(trim(p_observation_key),'') is null
    or nullif(trim(p_observation_fingerprint),'') is null
  then raise exception 'GROWTH_CREATIVE_OBSERVATION_REQUIRED_FIELDS_MISSING'; end if;
  if not exists(select 1 from public.jhadina_growth_creative_experiments where id=p_experiment_id and user_id=v_user)
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_NOT_FOUND'; end if;
  if not exists(select 1 from public.jhadina_growth_creative_variant_lineage
    where experiment_id=p_experiment_id and user_id=v_user and variant_id=p_variant_id)
  then raise exception 'GROWTH_CREATIVE_VARIANT_NOT_FOUND'; end if;
  if p_exposures < 0 or p_conversions < 0 or p_conversions > p_exposures or p_spend < 0
  then raise exception 'GROWTH_CREATIVE_OBSERVATION_METRICS_INVALID'; end if;
  if p_clicks is not null and (p_clicks < 0 or p_clicks > p_exposures)
  then raise exception 'GROWTH_CREATIVE_OBSERVATION_CLICKS_INVALID'; end if;
  if p_payments is not null and (p_payments < 0 or p_payments > p_conversions)
  then raise exception 'GROWTH_CREATIVE_OBSERVATION_PAYMENTS_INVALID'; end if;
  if jsonb_typeof(p_evidence_refs) <> 'array' or jsonb_array_length(p_evidence_refs)=0
  then raise exception 'GROWTH_CREATIVE_OBSERVATION_EVIDENCE_REQUIRED'; end if;

  select * into v_row from public.jhadina_growth_creative_experiment_observations
  where user_id=v_user and observation_key=p_observation_key;
  if v_row.id is not null then
    if v_row.observation_fingerprint <> p_observation_fingerprint
    then raise exception 'GROWTH_IDEMPOTENCY_CONFLICT'; end if;
    return v_row;
  end if;

  insert into public.jhadina_growth_creative_experiment_observations(
    user_id,experiment_id,variant_id,observation_key,observation_fingerprint,exposures,clicks,conversions,payments,
    spend,contribution_margin,observed_at,evidence_refs
  ) values (
    v_user,p_experiment_id,trim(p_variant_id),trim(p_observation_key),p_observation_fingerprint,p_exposures,p_clicks,
    p_conversions,p_payments,p_spend,p_contribution_margin,p_observed_at,p_evidence_refs
  ) returning * into v_row;
  return v_row;
end $$;

create or replace function growth_private.record_evidence_health_assessment(
  p_experiment_id uuid, p_assessment_key text, p_assessment_fingerprint text, p_source text, p_asset_ref text,
  p_checked_at timestamptz, p_age_seconds integer, p_freshness text, p_completeness numeric, p_monitor_coverage numeric,
  p_active_incident_count integer, p_upstream_issue_count integer, p_schema_anomaly boolean, p_volume_anomaly boolean,
  p_lineage_complete boolean, p_severity text, p_allowed_for_learning boolean, p_blockers jsonb, p_warnings jsonb,
  p_evidence_refs jsonb, p_assessment jsonb
)
returns public.jhadina_growth_evidence_health_assessments
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_row public.jhadina_growth_evidence_health_assessments;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_experiment_id is not null and not exists(
    select 1 from public.jhadina_growth_creative_experiments where id=p_experiment_id and user_id=v_user)
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_NOT_FOUND'; end if;
  if nullif(trim(p_assessment_key),'') is null or nullif(trim(p_assessment_fingerprint),'') is null
    or nullif(trim(p_source),'') is null or nullif(trim(p_asset_ref),'') is null
  then raise exception 'GROWTH_EVIDENCE_HEALTH_REQUIRED_FIELDS_MISSING'; end if;
  if p_age_seconds < 0 or p_completeness < 0 or p_completeness > 1 or p_monitor_coverage < 0
    or p_monitor_coverage > 1 or p_active_incident_count < 0 or p_upstream_issue_count < 0
  then raise exception 'GROWTH_EVIDENCE_HEALTH_VALUES_INVALID'; end if;
  if p_freshness not in ('fresh','stale') or p_severity not in ('healthy','degraded','blocked')
  then raise exception 'GROWTH_EVIDENCE_HEALTH_STATE_INVALID'; end if;
  if (p_severity='blocked' and p_allowed_for_learning)
    or (p_severity in ('healthy','degraded') and not p_allowed_for_learning)
  then raise exception 'GROWTH_EVIDENCE_HEALTH_AUTHORITY_INVALID'; end if;
  if jsonb_typeof(p_blockers) <> 'array' or jsonb_typeof(p_warnings) <> 'array'
    or jsonb_typeof(p_evidence_refs) <> 'array' or jsonb_array_length(p_evidence_refs)=0
    or jsonb_typeof(p_assessment) <> 'object'
  then raise exception 'GROWTH_EVIDENCE_HEALTH_JSON_INVALID'; end if;

  select * into v_row from public.jhadina_growth_evidence_health_assessments
  where user_id=v_user and assessment_key=p_assessment_key;
  if v_row.id is not null then
    if v_row.assessment_fingerprint <> p_assessment_fingerprint
    then raise exception 'GROWTH_IDEMPOTENCY_CONFLICT'; end if;
    return v_row;
  end if;

  insert into public.jhadina_growth_evidence_health_assessments(
    user_id,experiment_id,assessment_key,assessment_fingerprint,source,asset_ref,checked_at,age_seconds,freshness,
    completeness,monitor_coverage,active_incident_count,upstream_issue_count,schema_anomaly,volume_anomaly,
    lineage_complete,severity,allowed_for_learning,blockers,warnings,evidence_refs,assessment
  ) values (
    v_user,p_experiment_id,trim(p_assessment_key),p_assessment_fingerprint,trim(p_source),trim(p_asset_ref),p_checked_at,
    p_age_seconds,p_freshness,p_completeness,p_monitor_coverage,p_active_incident_count,p_upstream_issue_count,
    p_schema_anomaly,p_volume_anomaly,p_lineage_complete,p_severity,p_allowed_for_learning,p_blockers,p_warnings,
    p_evidence_refs,p_assessment
  ) returning * into v_row;
  return v_row;
end $$;

create or replace function growth_private.record_creative_experiment_assessment(
  p_experiment_id uuid, p_assessment_key text, p_assessment_fingerprint text,
  p_control_variant_id text, p_treatment_variant_id text, p_control_rate numeric, p_treatment_rate numeric,
  p_absolute_lift numeric, p_relative_lift numeric, p_z_score numeric, p_p_value numeric,
  p_confidence_interval95 jsonb, p_incremental_contribution numeric, p_incremental_contribution_per_exposure numeric,
  p_evidence_refs jsonb, p_status text, p_decision text, p_health_assessment_id uuid, p_assessed_at timestamptz,
  p_assessment jsonb
)
returns public.jhadina_growth_creative_experiment_assessments
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_row public.jhadina_growth_creative_experiment_assessments;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_growth_creative_experiments where id=p_experiment_id and user_id=v_user)
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_NOT_FOUND'; end if;
  if p_health_assessment_id is not null and not exists(
    select 1 from public.jhadina_growth_evidence_health_assessments
    where id=p_health_assessment_id and user_id=v_user and (experiment_id is null or experiment_id=p_experiment_id))
  then raise exception 'GROWTH_EVIDENCE_HEALTH_NOT_FOUND'; end if;
  if nullif(trim(p_assessment_key),'') is null or nullif(trim(p_assessment_fingerprint),'') is null
    or nullif(trim(p_control_variant_id),'') is null or nullif(trim(p_treatment_variant_id),'') is null
  then raise exception 'GROWTH_CREATIVE_ASSESSMENT_REQUIRED_FIELDS_MISSING'; end if;
  if p_control_variant_id=p_treatment_variant_id then raise exception 'GROWTH_AB_VARIANTS_MUST_DIFFER'; end if;
  if p_control_rate < 0 or p_control_rate > 1 or p_treatment_rate < 0 or p_treatment_rate > 1
  then raise exception 'GROWTH_CREATIVE_ASSESSMENT_RATE_INVALID'; end if;
  if p_p_value is not null and (p_p_value < 0 or p_p_value > 1)
  then raise exception 'GROWTH_CREATIVE_ASSESSMENT_P_VALUE_INVALID'; end if;
  if p_confidence_interval95 is not null and
    (jsonb_typeof(p_confidence_interval95) <> 'array' or jsonb_array_length(p_confidence_interval95) <> 2)
  then raise exception 'GROWTH_CREATIVE_ASSESSMENT_CI_INVALID'; end if;
  if p_status not in ('insufficient_evidence','inconclusive','statistically_supported',
    'statistically_supported_but_economically_weak','treatment_underperformed')
  then raise exception 'GROWTH_CREATIVE_ASSESSMENT_STATUS_INVALID'; end if;
  if p_decision not in ('keep_collecting','preserve_control','promote_treatment_for_next_test','do_not_scale_treatment')
  then raise exception 'GROWTH_CREATIVE_ASSESSMENT_DECISION_INVALID'; end if;
  if jsonb_typeof(p_evidence_refs) <> 'array' or jsonb_array_length(p_evidence_refs)=0
    or jsonb_typeof(p_assessment) <> 'object'
  then raise exception 'GROWTH_CREATIVE_ASSESSMENT_JSON_INVALID'; end if;

  select * into v_row from public.jhadina_growth_creative_experiment_assessments
  where user_id=v_user and assessment_key=p_assessment_key;
  if v_row.id is not null then
    if v_row.assessment_fingerprint <> p_assessment_fingerprint
    then raise exception 'GROWTH_IDEMPOTENCY_CONFLICT'; end if;
    return v_row;
  end if;

  insert into public.jhadina_growth_creative_experiment_assessments(
    user_id,experiment_id,assessment_key,assessment_fingerprint,control_variant_id,treatment_variant_id,
    control_rate,treatment_rate,absolute_lift,relative_lift,z_score,p_value,confidence_interval95,
    incremental_contribution,incremental_contribution_per_exposure,evidence_refs,status,decision,
    health_assessment_id,assessed_at,assessment
  ) values (
    v_user,p_experiment_id,trim(p_assessment_key),p_assessment_fingerprint,trim(p_control_variant_id),
    trim(p_treatment_variant_id),p_control_rate,p_treatment_rate,p_absolute_lift,p_relative_lift,p_z_score,p_p_value,
    p_confidence_interval95,p_incremental_contribution,p_incremental_contribution_per_exposure,p_evidence_refs,
    p_status,p_decision,p_health_assessment_id,p_assessed_at,p_assessment
  ) returning * into v_row;
  return v_row;
end $$;

create or replace function growth_private.set_creative_experiment_status(
  p_experiment_id uuid, p_expected_status text, p_status text
)
returns public.jhadina_growth_creative_experiments
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_row public.jhadina_growth_creative_experiments;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select * into v_row from public.jhadina_growth_creative_experiments
  where id=p_experiment_id and user_id=v_user for update;
  if v_row.id is null then raise exception 'GROWTH_CREATIVE_EXPERIMENT_NOT_FOUND'; end if;
  if v_row.status <> p_expected_status then raise exception 'GROWTH_CREATIVE_EXPERIMENT_STATUS_CONFLICT'; end if;
  if p_status not in ('planned','running','paused','completed','cancelled')
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_STATUS_INVALID'; end if;
  if v_row.status in ('completed','cancelled') and p_status <> v_row.status
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_TERMINAL'; end if;
  if v_row.status='planned' and p_status not in ('planned','running','cancelled')
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_TRANSITION_INVALID'; end if;
  if v_row.status='running' and p_status not in ('running','paused','completed','cancelled')
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_TRANSITION_INVALID'; end if;
  if v_row.status='paused' and p_status not in ('paused','running','completed','cancelled')
  then raise exception 'GROWTH_CREATIVE_EXPERIMENT_TRANSITION_INVALID'; end if;

  update public.jhadina_growth_creative_experiments
  set status=p_status,
      started_at=case when started_at is null and p_status='running' then now() else started_at end,
      completed_at=case when p_status='completed' then coalesce(completed_at,now()) else completed_at end,
      updated_at=now()
  where id=p_experiment_id and user_id=v_user
  returning * into v_row;
  return v_row;
end $$;

grant usage on schema growth_private to authenticated;

revoke execute on function growth_private.record_creative_experiment(text,text,text,text,jsonb,text,jsonb,jsonb,text,text,text) from public, anon;
grant execute on function growth_private.record_creative_experiment(text,text,text,text,jsonb,text,jsonb,jsonb,text,text,text) to authenticated;
revoke execute on function growth_private.record_creative_variant_lineage(uuid,text,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,integer,text,jsonb,text,jsonb) from public, anon;
grant execute on function growth_private.record_creative_variant_lineage(uuid,text,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,integer,text,jsonb,text,jsonb) to authenticated;
revoke execute on function growth_private.record_creative_experiment_observation(uuid,text,text,text,bigint,bigint,bigint,bigint,numeric,numeric,timestamptz,jsonb) from public, anon;
grant execute on function growth_private.record_creative_experiment_observation(uuid,text,text,text,bigint,bigint,bigint,bigint,numeric,numeric,timestamptz,jsonb) to authenticated;
revoke execute on function growth_private.record_evidence_health_assessment(uuid,text,text,text,text,timestamptz,integer,text,numeric,numeric,integer,integer,boolean,boolean,boolean,text,boolean,jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function growth_private.record_evidence_health_assessment(uuid,text,text,text,text,timestamptz,integer,text,numeric,numeric,integer,integer,boolean,boolean,boolean,text,boolean,jsonb,jsonb,jsonb,jsonb) to authenticated;
revoke execute on function growth_private.record_creative_experiment_assessment(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,jsonb,numeric,numeric,jsonb,text,text,uuid,timestamptz,jsonb) from public, anon;
grant execute on function growth_private.record_creative_experiment_assessment(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,jsonb,numeric,numeric,jsonb,text,text,uuid,timestamptz,jsonb) to authenticated;
revoke execute on function growth_private.set_creative_experiment_status(uuid,text,text) from public, anon;
grant execute on function growth_private.set_creative_experiment_status(uuid,text,text) to authenticated;
