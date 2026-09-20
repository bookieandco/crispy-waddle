-- K-1.4.9 reconciliation baseline.
-- Reconstructs the live Knowledge/Research contracts that were previously only
-- present in project migration history, before the 17:20+ hardening migrations.

create extension if not exists pgcrypto;

create table if not exists public.jhadina_execution_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  request_id text not null,
  action_id text not null,
  actor_id uuid not null,
  capability text not null,
  authorization_context jsonb not null default '{}'::jsonb,
  approval_state text not null check (approval_state in ('PENDING_APPROVAL','APPROVED','REJECTED','EXPIRED')),
  execution_state text not null default 'NOT_EXECUTED' check (execution_state in ('NOT_EXECUTED','EXECUTED','FAILED','CANCELLED')),
  approved_at timestamptz,
  executed_at timestamptz,
  result_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id,action_id)
);
alter table public.jhadina_execution_receipts enable row level security;

create table if not exists public.jhadina_knowledge_records (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  claim text not null,
  confidence numeric not null check (confidence between 0 and 1),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INVALIDATED')),
  invalidation_reason text,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_id uuid,
  scope text not null default 'system',
  knowledge_type text not null default 'fact',
  predicate text not null default 'asserts',
  object_json jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  valid_from timestamptz,
  valid_until timestamptz,
  verification_state text not null default 'unverified',
  authority_score numeric not null default 0,
  freshness_score numeric not null default 0,
  content_hash text,
  version integer not null default 1,
  last_verified_at timestamptz,
  freshness_sla_hours integer,
  freshness_state text not null default 'unknown',
  content_changed boolean not null default false,
  last_checked_at timestamptz,
  superseded_by uuid references public.jhadina_knowledge_records(id) on delete set null
);

alter table public.jhadina_knowledge_records
  add column if not exists owner_id uuid,
  add column if not exists scope text not null default 'system',
  add column if not exists knowledge_type text not null default 'fact',
  add column if not exists predicate text not null default 'asserts',
  add column if not exists object_json jsonb not null default '{}'::jsonb,
  add column if not exists observed_at timestamptz,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_until timestamptz,
  add column if not exists verification_state text not null default 'unverified',
  add column if not exists authority_score numeric not null default 0,
  add column if not exists freshness_score numeric not null default 0,
  add column if not exists content_hash text,
  add column if not exists version integer not null default 1,
  add column if not exists last_verified_at timestamptz,
  add column if not exists freshness_sla_hours integer,
  add column if not exists freshness_state text not null default 'unknown',
  add column if not exists content_changed boolean not null default false,
  add column if not exists last_checked_at timestamptz,
  add column if not exists superseded_by uuid;

update public.jhadina_knowledge_records
set object_json = case when object_json='{}'::jsonb then jsonb_build_object('value',claim) else object_json end,
    observed_at = coalesce(observed_at,updated_at,created_at,now()),
    verification_state = case
      when status='ACTIVE' and verification_state='unverified' then 'provisional'
      when status='INVALIDATED' then 'rejected'
      else verification_state
    end
where observed_at is null or object_json='{}'::jsonb or verification_state='unverified';

alter table public.jhadina_knowledge_records alter column observed_at set not null;
alter table public.jhadina_knowledge_records enable row level security;

create table if not exists public.jhadina_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('github','web','pdf','api','database','conversation','user','system')),
  uri text not null unique,
  publisher text,
  authority text not null default 'unknown' check (authority in ('primary','official','secondary','community','user','system','unknown')),
  trust_score numeric not null default 0 check (trust_score between 0 and 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_verified_at timestamptz,
  freshness_sla_hours numeric check (freshness_sla_hours is null or freshness_sla_hours>=0),
  content_hash text,
  external_source_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_knowledge_evidence (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.jhadina_knowledge_sources(id) on delete restrict,
  knowledge_record_id uuid references public.jhadina_knowledge_records(id) on delete set null,
  document_id uuid,
  locator jsonb not null default '{}'::jsonb,
  excerpt text,
  content_hash text,
  captured_at timestamptz not null default now(),
  last_verified_at timestamptz,
  verification_state text not null default 'unverified'
    check (verification_state in ('unverified','provisional','verified','disputed','stale','rejected')),
  authority_score numeric not null default 0 check (authority_score between 0 and 1),
  freshness_sla_hours numeric check (freshness_sla_hours is null or freshness_sla_hours>=0),
  freshness_state text not null default 'unknown'
    check (freshness_state in ('fresh','stale','expired','changed','unknown')),
  content_changed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jhadina_knowledge_sources enable row level security;
alter table public.jhadina_knowledge_evidence enable row level security;

create index if not exists jhadina_knowledge_records_scope_idx on public.jhadina_knowledge_records(scope);
create index if not exists jhadina_knowledge_records_type_idx on public.jhadina_knowledge_records(knowledge_type);
create index if not exists jhadina_knowledge_records_verification_idx on public.jhadina_knowledge_records(verification_state);
create index if not exists jhadina_knowledge_records_observed_idx on public.jhadina_knowledge_records(observed_at desc);
create index if not exists jhadina_knowledge_evidence_record_idx on public.jhadina_knowledge_evidence(knowledge_record_id);
create index if not exists jhadina_knowledge_evidence_source_idx on public.jhadina_knowledge_evidence(source_id);

create or replace function public.jhadina_knowledge_freshness_state(
  p_observed_at timestamptz,
  p_last_verified_at timestamptz,
  p_freshness_sla_hours numeric,
  p_content_changed boolean,
  p_now timestamptz
) returns text
language sql immutable security invoker
set search_path=public,pg_catalog
as $$
  select case
    when p_content_changed then 'changed'
    when p_freshness_sla_hours is null or p_last_verified_at is null then 'unknown'
    when p_now <= p_last_verified_at + make_interval(secs => (p_freshness_sla_hours*3600)::double precision) then 'fresh'
    when p_now <= p_last_verified_at + make_interval(secs => (p_freshness_sla_hours*7200)::double precision) then 'stale'
    else 'expired'
  end;
$$;

create or replace function public.jhadina_evidence_freshness_state(
  p_captured_at timestamptz,
  p_last_verified_at timestamptz,
  p_freshness_sla_hours numeric,
  p_content_changed boolean default false,
  p_now timestamptz default now()
) returns text
language sql stable security invoker
set search_path=public,pg_catalog
as $$
  select case
    when p_content_changed then 'changed'
    when p_freshness_sla_hours is null or p_last_verified_at is null then 'unknown'
    when p_now <= p_last_verified_at + make_interval(secs => (p_freshness_sla_hours*3600)::double precision) then 'fresh'
    when p_now <= p_last_verified_at + make_interval(secs => (p_freshness_sla_hours*7200)::double precision) then 'stale'
    else 'expired'
  end;
$$;

create table if not exists public.jhadina_research_source_performance (
  source_id text primary key,
  investigations bigint not null default 0,
  useful_evidence bigint not null default 0,
  corroborated_evidence bigint not null default 0,
  verified_evidence bigint not null default 0,
  rejected_evidence bigint not null default 0,
  score double precision not null default 0,
  updated_at timestamptz not null default now(),
  decayed_score double precision not null default 0,
  posterior_mean double precision not null default 0.5,
  posterior_lower_bound double precision not null default 0,
  posterior_upper_bound double precision not null default 1,
  performance_policy_version integer not null default 1
);
alter table public.jhadina_research_source_performance enable row level security;

create table if not exists public.jhadina_research_source_performance_policy (
  policy_key text primary key,
  policy_version integer not null,
  half_life_days numeric not null,
  minimum_score numeric not null,
  prior_alpha numeric not null,
  prior_beta numeric not null,
  exploration_weight numeric not null,
  updated_at timestamptz not null default now()
);
insert into public.jhadina_research_source_performance_policy(
  policy_key,policy_version,half_life_days,minimum_score,prior_alpha,prior_beta,exploration_weight
) values ('default',1,30,-1,1,1,0.35)
on conflict(policy_key) do nothing;
alter table public.jhadina_research_source_performance_policy enable row level security;

create table if not exists public.jhadina_research_revalidation_triggers (
  id uuid primary key default gen_random_uuid(),
  knowledge_record_id uuid not null references public.jhadina_knowledge_records(id) on delete restrict,
  triggering_evidence_id uuid references public.jhadina_knowledge_evidence(id) on delete restrict,
  trigger_reason text not null check (trigger_reason in ('stale','expired','changed','manual','contradicted')),
  freshness_state text not null check (freshness_state in ('unknown','fresh','stale','expired','changed')),
  research_scope jsonb not null default '{}'::jsonb,
  required_authority text not null default 'official'
    check (required_authority in ('primary','official','secondary','community','any')),
  max_depth integer not null default 2 check (max_depth between 0 and 20),
  max_breadth integer not null default 4 check (max_breadth between 1 and 100),
  policy_requirements jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','planned','running','completed','superseded','failed')),
  dedupe_key text not null unique,
  research_intent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_research_intents (
  id uuid primary key default gen_random_uuid(),
  trigger_id uuid references public.jhadina_research_revalidation_triggers(id) on delete restrict,
  knowledge_record_id uuid references public.jhadina_knowledge_records(id) on delete restrict,
  intent_type text not null check (intent_type in (
    'discovery','fact_verification','knowledge_revalidation','literature_review','comparison',
    'problem_definition','methodology_design','research_plan','technical_investigation',
    'market_research','due_diligence','hypothesis_testing','contradiction_resolution','opportunity_discovery'
  )),
  objective text not null,
  questions jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  claims_to_test jsonb not null default '[]'::jsonb,
  scope jsonb not null default '{}'::jsonb,
  evidence_requirements jsonb not null default '{}'::jsonb,
  search_strategy jsonb not null default '{}'::jsonb,
  objectivity_requirements jsonb not null default '{}'::jsonb,
  policy_requirements jsonb not null default '{}'::jsonb,
  classification jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','planned','approved','running','completed','blocked','failed','cancelled')),
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_research_intent_decompositions (
  id uuid primary key default gen_random_uuid(),
  research_intent_id uuid not null references public.jhadina_research_intents(id) on delete restrict,
  objective text not null,
  questions jsonb not null default '[]'::jsonb,
  claims_to_test jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  evidence_requirements jsonb not null default '{}'::jsonb,
  search_dimensions jsonb not null default '{}'::jsonb,
  stopping_criteria jsonb not null default '{}'::jsonb,
  unresolved_ambiguities jsonb not null default '[]'::jsonb,
  classifier_confidence numeric check (classifier_confidence is null or classifier_confidence between 0 and 1),
  decomposition_version integer not null default 1 check (decomposition_version>0),
  status text not null default 'draft' check (status in ('draft','validated','rejected')),
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(research_intent_id,decomposition_version)
);

create table if not exists public.jhadina_research_plans (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.jhadina_research_intents(id) on delete restrict,
  decomposition_id uuid not null references public.jhadina_research_intent_decompositions(id) on delete restrict,
  plan_version integer not null default 1 check (plan_version>0),
  tasks jsonb not null default '[]'::jsonb,
  source_constraints jsonb not null default '{}'::jsonb,
  evidence_requirements jsonb not null default '{}'::jsonb,
  breadth integer not null default 1 check (breadth between 1 and 100),
  depth integer not null default 1 check (depth between 0 and 20),
  stopping_criteria jsonb not null default '{}'::jsonb,
  contradiction_checks jsonb not null default '{}'::jsonb,
  budget jsonb not null default '{}'::jsonb,
  policy_requirements jsonb not null default '{}'::jsonb,
  policy_snapshot jsonb not null default '{}'::jsonb,
  content_hash text,
  status text not null default 'draft'
    check (status in ('draft','compiled','pending_policy','approved','running','completed','blocked','failed','cancelled','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(intent_id,plan_version)
);

create table if not exists public.jhadina_research_policy_decisions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.jhadina_research_plans(id) on delete restrict,
  decision text not null check (decision in ('allow','deny','escalate')),
  policy_version text not null,
  required_capabilities jsonb not null default '[]'::jsonb,
  required_authorities jsonb not null default '[]'::jsonb,
  approval_mode text not null default 'none'
    check (approval_mode in ('none','user','operator','capability_owner')),
  reasons jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  evaluator_version text not null,
  evaluated_at timestamptz not null default now(),
  audit_receipt_id uuid references public.jhadina_execution_receipts(receipt_id) on delete restrict,
  created_at timestamptz not null default now(),
  action_proposal_id text,
  capability text,
  admitted_for_execution boolean not null default false,
  unique(plan_id,policy_version,evaluator_version)
);

create table if not exists public.jhadina_research_execution_leases (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.jhadina_research_plans(id) on delete restrict,
  policy_decision_id uuid not null references public.jhadina_research_policy_decisions(id) on delete restrict,
  lease_token text not null,
  worker_id text not null,
  state text not null default 'active'
    check (state in ('active','expired','released','fenced','completed','failed')),
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  renewed_at timestamptz,
  released_at timestamptz,
  attempt_count integer not null default 1 check (attempt_count>0),
  budget_snapshot jsonb not null default '{}'::jsonb,
  bounds_snapshot jsonb not null default '{}'::jsonb,
  lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists jhadina_research_execution_one_active_idx
on public.jhadina_research_execution_leases(plan_id) where state='active';

create table if not exists public.jhadina_research_execution_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.jhadina_research_plans(id) on delete restrict,
  lease_id uuid references public.jhadina_research_execution_leases(id) on delete restrict,
  sequence_no bigint not null,
  event_type text not null check (event_type in (
    'admitted','task_started','source_queried','evidence_captured','task_completed',
    'contradiction_found','budget_exhausted','stopped','completed','failed','fenced'
  )),
  task_id text,
  payload jsonb not null default '{}'::jsonb,
  expected_budget jsonb not null default '{}'::jsonb,
  actual_usage jsonb not null default '{}'::jsonb,
  result_status text,
  content_hash text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(plan_id,sequence_no)
);

alter table public.jhadina_research_revalidation_triggers enable row level security;
alter table public.jhadina_research_intents enable row level security;
alter table public.jhadina_research_intent_decompositions enable row level security;
alter table public.jhadina_research_plans enable row level security;
alter table public.jhadina_research_policy_decisions enable row level security;
alter table public.jhadina_research_execution_leases enable row level security;
alter table public.jhadina_research_execution_events enable row level security;

create index if not exists jhadina_research_intents_status_idx on public.jhadina_research_intents(status,created_at desc);
create index if not exists jhadina_research_decompositions_status_idx on public.jhadina_research_intent_decompositions(status,created_at desc);
create index if not exists jhadina_research_plans_status_idx on public.jhadina_research_plans(status,created_at desc);
create index if not exists jhadina_research_policy_decision_idx on public.jhadina_research_policy_decisions(decision,evaluated_at desc);
create index if not exists jhadina_research_execution_events_plan_idx on public.jhadina_research_execution_events(plan_id,sequence_no);

create or replace function public.jhadina_create_revalidation_trigger(
  p_knowledge_record_id uuid,
  p_trigger_reason text,
  p_freshness_state text,
  p_triggering_evidence_id uuid default null,
  p_research_scope jsonb default '{}'::jsonb,
  p_required_authority text default 'official',
  p_max_depth integer default 2,
  p_max_breadth integer default 4,
  p_policy_requirements jsonb default '{}'::jsonb,
  p_dedupe_key text default null
) returns public.jhadina_research_revalidation_triggers
language plpgsql security invoker set search_path=public,pg_catalog
as $$
declare v_key text; v_row public.jhadina_research_revalidation_triggers%rowtype;
begin
  v_key:=coalesce(p_dedupe_key,encode(digest(
    concat_ws('|',p_knowledge_record_id::text,p_trigger_reason,p_freshness_state,
      coalesce(p_triggering_evidence_id::text,''),coalesce(p_research_scope,'{}'::jsonb)::text),
    'sha256'),'hex'));
  insert into public.jhadina_research_revalidation_triggers(
    knowledge_record_id,triggering_evidence_id,trigger_reason,freshness_state,research_scope,
    required_authority,max_depth,max_breadth,policy_requirements,dedupe_key
  ) values(
    p_knowledge_record_id,p_triggering_evidence_id,p_trigger_reason,p_freshness_state,
    coalesce(p_research_scope,'{}'::jsonb),p_required_authority,p_max_depth,p_max_breadth,
    coalesce(p_policy_requirements,'{}'::jsonb),v_key
  )
  on conflict(dedupe_key) do update set updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.jhadina_compile_research_plan(
  p_decomposition_id uuid,
  p_policy_version text,
  p_required_capabilities jsonb default '[]'::jsonb,
  p_required_authorities jsonb default '[]'::jsonb,
  p_approval_mode text default 'none',
  p_breadth integer default 1,
  p_depth integer default 1,
  p_budget jsonb default '{}'::jsonb
) returns public.jhadina_research_plans
language plpgsql security invoker set search_path=public,pg_catalog
as $$
declare
  v_d public.jhadina_research_intent_decompositions%rowtype;
  v_version integer;
  v_tasks jsonb;
  v_snapshot jsonb;
  v_hash text;
  v_row public.jhadina_research_plans%rowtype;
begin
  select * into v_d from public.jhadina_research_intent_decompositions
  where id=p_decomposition_id and status='validated';
  if not found then raise exception 'validated_decomposition_required'; end if;
  if p_breadth<1 or p_breadth>100 or p_depth<0 or p_depth>20 then raise exception 'research_bounds_invalid'; end if;

  select coalesce(max(plan_version),0)+1 into v_version
  from public.jhadina_research_plans where intent_id=v_d.research_intent_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id','q-'||ordinality::text,'objective',value,'dependencies','[]'::jsonb,
    'priority',0,'expectedValue',0,'cost',0,'risk',0,'authorizationClass','analysis'
  ) order by ordinality),'[]'::jsonb)
  into v_tasks
  from jsonb_array_elements_text(v_d.questions) with ordinality q(value,ordinality);

  v_snapshot:=jsonb_build_object(
    'policyVersion',p_policy_version,'requiredCapabilities',coalesce(p_required_capabilities,'[]'::jsonb),
    'requiredAuthorities',coalesce(p_required_authorities,'[]'::jsonb),'approvalMode',p_approval_mode
  );
  v_hash:=encode(digest(jsonb_build_object(
    'decompositionId',p_decomposition_id,'version',v_version,'tasks',v_tasks,
    'breadth',p_breadth,'depth',p_depth,'budget',coalesce(p_budget,'{}'::jsonb),'policy',v_snapshot
  )::text,'sha256'),'hex');

  insert into public.jhadina_research_plans(
    intent_id,decomposition_id,plan_version,tasks,evidence_requirements,breadth,depth,
    stopping_criteria,contradiction_checks,budget,policy_requirements,policy_snapshot,content_hash,status
  ) values(
    v_d.research_intent_id,p_decomposition_id,v_version,v_tasks,v_d.evidence_requirements,
    p_breadth,p_depth,v_d.stopping_criteria,jsonb_build_object('required',true),
    coalesce(p_budget,'{}'::jsonb),v_snapshot,v_snapshot,v_hash,'pending_policy'
  ) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.jhadina_evaluate_research_policy(
  p_plan_id uuid,
  p_policy_version text,
  p_evaluator_version text,
  p_available_capabilities jsonb default '[]'::jsonb,
  p_allowed_authorities jsonb default '[]'::jsonb,
  p_approval_granted boolean default false
) returns public.jhadina_research_policy_decisions
language plpgsql security invoker set search_path=public,pg_catalog
as $$
declare
  v_plan public.jhadina_research_plans%rowtype;
  v_required_caps jsonb;
  v_required_auth jsonb;
  v_mode text;
  v_missing_caps boolean;
  v_missing_auth boolean;
  v_decision text;
  v_reasons jsonb:='[]'::jsonb;
  v_row public.jhadina_research_policy_decisions%rowtype;
begin
  select * into v_plan from public.jhadina_research_plans where id=p_plan_id for update;
  if not found then raise exception 'research_plan_not_found'; end if;
  v_required_caps:=coalesce(v_plan.policy_snapshot->'requiredCapabilities','[]'::jsonb);
  v_required_auth:=coalesce(v_plan.policy_snapshot->'requiredAuthorities','[]'::jsonb);
  v_mode:=coalesce(v_plan.policy_snapshot->>'approvalMode','none');

  select exists(
    select 1 from jsonb_array_elements_text(v_required_caps) x
    where not (coalesce(p_available_capabilities,'[]'::jsonb) ? x)
  ) into v_missing_caps;
  select exists(
    select 1 from jsonb_array_elements_text(v_required_auth) x
    where not (coalesce(p_allowed_authorities,'[]'::jsonb) ? x)
  ) into v_missing_auth;

  if v_missing_caps then v_decision:='deny'; v_reasons:=v_reasons||jsonb_build_array('missing_capability');
  elsif v_missing_auth then v_decision:='deny'; v_reasons:=v_reasons||jsonb_build_array('authority_not_allowed');
  elsif v_mode<>'none' and not p_approval_granted then v_decision:='escalate'; v_reasons:=v_reasons||jsonb_build_array('approval_required');
  else v_decision:='allow';
  end if;

  insert into public.jhadina_research_policy_decisions(
    plan_id,decision,policy_version,required_capabilities,required_authorities,approval_mode,
    reasons,constraints,evaluator_version
  ) values(
    p_plan_id,v_decision,p_policy_version,v_required_caps,v_required_auth,v_mode,
    v_reasons,jsonb_build_object('planContentHash',v_plan.content_hash),p_evaluator_version
  )
  on conflict(plan_id,policy_version,evaluator_version) do update
    set decision=excluded.decision,reasons=excluded.reasons,evaluated_at=now()
  returning * into v_row;

  update public.jhadina_research_plans
  set status=case when v_decision='allow' then 'approved'
                  when v_decision='deny' then 'blocked'
                  else 'pending_policy' end,
      updated_at=now()
  where id=p_plan_id;
  return v_row;
end;
$$;

create or replace function public.jhadina_research_execution_admissible(p_decision_id uuid)
returns boolean language sql stable security invoker set search_path=public,pg_catalog
as $$
  select exists(
    select 1 from public.jhadina_research_policy_decisions d
    join public.jhadina_research_plans p on p.id=d.plan_id
    where d.id=p_decision_id and d.decision='allow' and d.admitted_for_execution
      and p.status in ('approved','running')
  );
$$;

revoke all on public.jhadina_knowledge_records,public.jhadina_knowledge_sources,public.jhadina_knowledge_evidence,
  public.jhadina_research_revalidation_triggers,public.jhadina_research_intents,
  public.jhadina_research_intent_decompositions,public.jhadina_research_plans,
  public.jhadina_research_policy_decisions,public.jhadina_research_execution_leases,
  public.jhadina_research_execution_events,public.jhadina_research_source_performance,
  public.jhadina_research_source_performance_policy
from anon,authenticated;

grant select,insert,update,delete on public.jhadina_knowledge_records,public.jhadina_knowledge_sources,
  public.jhadina_knowledge_evidence,public.jhadina_research_revalidation_triggers,
  public.jhadina_research_intents,public.jhadina_research_intent_decompositions,
  public.jhadina_research_plans,public.jhadina_research_policy_decisions,
  public.jhadina_research_execution_leases,public.jhadina_research_execution_events,
  public.jhadina_research_source_performance,public.jhadina_research_source_performance_policy
to service_role;

drop policy if exists jhadina_research_source_performance_policy_service_role on public.jhadina_research_source_performance_policy;
create policy jhadina_research_source_performance_policy_service_role
on public.jhadina_research_source_performance_policy for all to service_role
using(true) with check(true);

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in(
      'jhadina_knowledge_freshness_state','jhadina_evidence_freshness_state',
      'jhadina_create_revalidation_trigger','jhadina_compile_research_plan',
      'jhadina_evaluate_research_policy','jhadina_research_execution_admissible'
    )
  loop
    execute format('revoke execute on function %s from public,anon,authenticated',r.signature);
    execute format('grant execute on function %s to service_role',r.signature);
  end loop;

  if to_regprocedure('public.jhadina_execution_receipts_guard()') is not null then
    execute 'revoke execute on function public.jhadina_execution_receipts_guard() from public,anon,authenticated';
  end if;
end $$;
