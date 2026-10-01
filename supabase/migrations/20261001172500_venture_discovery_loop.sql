-- VENTURE-DISCOVERY.2-.4
-- Durable global candidate synthesis + owner-scoped auto-adoption policy.
-- Candidate intelligence is globally readable to authenticated users.
-- Candidate adoption creates only a discovered Opportunity record; it grants no execution authority.

create table if not exists public.jhadina_venture_candidate_inbox (
  id text primary key,
  seed_id text not null,
  family text not null,
  recommendation text not null check (recommendation in ('research','hold','reject')),
  score double precision not null check (score >= 0 and score <= 100),
  signal_ids text[] not null default '{}',
  source_refs text[] not null default '{}',
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  generated_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_venture_candidate_inbox_rank_idx
  on public.jhadina_venture_candidate_inbox(active, recommendation, score desc, updated_at desc);
create index if not exists jhadina_venture_candidate_inbox_family_idx
  on public.jhadina_venture_candidate_inbox(family, active, score desc, updated_at desc);

create table if not exists public.jhadina_venture_discovery_policies (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  auto_adopt_candidates boolean not null default false,
  minimum_candidate_score double precision not null default 75
    check (minimum_candidate_score >= 0 and minimum_candidate_score <= 100),
  allowed_families text[] not null default '{}',
  max_adoptions_per_run integer not null default 3
    check (max_adoptions_per_run >= 1 and max_adoptions_per_run <= 25),
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_venture_discovery_policies_auto_idx
  on public.jhadina_venture_discovery_policies(enabled, auto_adopt_candidates, updated_at desc);

create table if not exists public.jhadina_venture_candidate_adoptions (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id text not null references public.jhadina_venture_candidate_inbox(id) on delete cascade,
  opportunity_id text not null,
  status text not null check (status in ('adopted','dismissed')),
  adopted_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  primary key (owner_user_id, candidate_id),
  foreign key (owner_user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_venture_candidate_adoptions_owner_time_idx
  on public.jhadina_venture_candidate_adoptions(owner_user_id, adopted_at desc);

alter table public.jhadina_venture_candidate_inbox enable row level security;
alter table public.jhadina_venture_discovery_policies enable row level security;
alter table public.jhadina_venture_candidate_adoptions enable row level security;

drop policy if exists "jhadina_venture_candidate_inbox_authenticated_read" on public.jhadina_venture_candidate_inbox;
create policy "jhadina_venture_candidate_inbox_authenticated_read"
  on public.jhadina_venture_candidate_inbox
  for select to authenticated
  using (true);

drop policy if exists "jhadina_venture_discovery_policies_select_own" on public.jhadina_venture_discovery_policies;
create policy "jhadina_venture_discovery_policies_select_own"
  on public.jhadina_venture_discovery_policies
  for select to authenticated
  using ((select auth.uid()) = owner_user_id);

drop policy if exists "jhadina_venture_candidate_adoptions_select_own" on public.jhadina_venture_candidate_adoptions;
create policy "jhadina_venture_candidate_adoptions_select_own"
  on public.jhadina_venture_candidate_adoptions
  for select to authenticated
  using ((select auth.uid()) = owner_user_id);

revoke all on public.jhadina_venture_candidate_inbox from public, anon, authenticated;
revoke all on public.jhadina_venture_discovery_policies from public, anon, authenticated;
revoke all on public.jhadina_venture_candidate_adoptions from public, anon, authenticated;

grant select on public.jhadina_venture_candidate_inbox to authenticated;
grant select on public.jhadina_venture_discovery_policies to authenticated;
grant select on public.jhadina_venture_candidate_adoptions to authenticated;

grant select, insert, update, delete on public.jhadina_venture_candidate_inbox to service_role;
grant select, insert, update, delete on public.jhadina_venture_discovery_policies to service_role;
grant select, insert, update, delete on public.jhadina_venture_candidate_adoptions to service_role;

create or replace function public.jhadina_venture_candidate_adopt(
  p_owner_user_id uuid,
  p_candidate_id text,
  p_opportunity jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_policy public.jhadina_venture_discovery_policies%rowtype;
  v_candidate public.jhadina_venture_candidate_inbox%rowtype;
  v_opportunity_id text := p_opportunity->>'id';
  v_existing boolean;
  v_now timestamptz := now();
begin
  if p_owner_user_id is null then raise exception 'owner user id is required'; end if;
  if coalesce(p_candidate_id,'') = '' then raise exception 'candidate id is required'; end if;
  if coalesce(v_opportunity_id,'') = '' then raise exception 'opportunity id is required'; end if;

  select * into v_policy
    from public.jhadina_venture_discovery_policies
   where owner_user_id = p_owner_user_id;

  if not found or not v_policy.enabled or not v_policy.auto_adopt_candidates then
    raise exception 'venture auto-adoption policy is not enabled';
  end if;

  select * into v_candidate
    from public.jhadina_venture_candidate_inbox
   where id = p_candidate_id and active = true
   for update;

  if not found then raise exception 'venture candidate not found'; end if;
  if v_candidate.recommendation <> 'research' then raise exception 'venture candidate is not research-ready'; end if;
  if v_candidate.score < v_policy.minimum_candidate_score then raise exception 'venture candidate score below policy minimum'; end if;
  if cardinality(v_policy.allowed_families) > 0
     and not (v_candidate.family = any(v_policy.allowed_families)) then
    raise exception 'venture candidate family is not allowed by policy';
  end if;

  if coalesce(p_opportunity->>'status','') <> 'discovered'
     or coalesce(p_opportunity->>'family','') <> 'business'
     or coalesce(p_opportunity->>'type','') <> 'commercial' then
    raise exception 'candidate adoption may only create discovered commercial business opportunities';
  end if;

  select exists(
    select 1 from public.jhadina_venture_candidate_adoptions
     where owner_user_id = p_owner_user_id and candidate_id = p_candidate_id
  ) into v_existing;

  if v_existing then
    return jsonb_build_object(
      'adopted', false,
      'alreadyAdopted', true,
      'candidateId', p_candidate_id,
      'opportunityId', v_opportunity_id
    );
  end if;

  insert into public.jhadina_opportunities (
    user_id,id,family,opportunity_type,status,source_name,source_url,
    deadline,fit_score,triage_state,approved_at,research_case_id,payload,created_at,updated_at
  ) values (
    p_owner_user_id,
    v_opportunity_id,
    'business',
    'commercial',
    'discovered',
    coalesce(nullif(p_opportunity->>'sourceName',''),'Jhadina Venture Discovery'),
    coalesce(nullif(p_opportunity->>'sourceUrl',''),'https://jhadina.local/venture-candidates'),
    null,
    nullif(p_opportunity->>'fitScore','')::double precision,
    'review',
    null,
    null,
    p_opportunity,
    coalesce(nullif(p_opportunity->>'createdAt','')::timestamptz,v_now),
    coalesce(nullif(p_opportunity->>'updatedAt','')::timestamptz,v_now)
  )
  on conflict (user_id,id) do nothing;

  insert into public.jhadina_venture_candidate_adoptions (
    owner_user_id,candidate_id,opportunity_id,status,adopted_at,payload
  ) values (
    p_owner_user_id,p_candidate_id,v_opportunity_id,'adopted',v_now,
    jsonb_build_object(
      'externalActionAuthorized', false,
      'automaticExperimentAuthorized', false,
      'moneyMovementAuthorized', false
    )
  );

  return jsonb_build_object(
    'adopted', true,
    'alreadyAdopted', false,
    'candidateId', p_candidate_id,
    'opportunityId', v_opportunity_id,
    'externalActionAuthorized', false,
    'automaticExperimentAuthorized', false,
    'moneyMovementAuthorized', false
  );
end;
$$;

revoke all on function public.jhadina_venture_candidate_adopt(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.jhadina_venture_candidate_adopt(uuid,text,jsonb) to service_role;
