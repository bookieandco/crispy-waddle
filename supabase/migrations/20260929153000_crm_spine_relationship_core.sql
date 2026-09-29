-- CRM-SPINE.9 / CRM-SPINE.FINAL
-- Shared relationship memory. This schema grants no outreach or execution authority.

create table if not exists public.jhadina_relationship_entities (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('person','organization')),
  display_name text not null,
  status text not null check (status in ('active','inactive','merged','archived')),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id,id)
);

create table if not exists public.jhadina_relationship_identities (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  entity_id text not null,
  scheme text not null,
  value text not null,
  normalized_value text not null,
  verified_at timestamptz,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array' and jsonb_array_length(evidence_refs)>0),
  primary key (user_id,id),
  foreign key (user_id,entity_id) references public.jhadina_relationship_entities(user_id,id) on delete cascade,
  unique (user_id,scheme,normalized_value)
);

create table if not exists public.jhadina_relationship_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  entity_id text not null,
  role text not null,
  domain text not null,
  context_ref text,
  valid_from timestamptz not null,
  valid_to timestamptz,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array' and jsonb_array_length(evidence_refs)>0),
  primary key (user_id,id),
  foreign key (user_id,entity_id) references public.jhadina_relationship_entities(user_id,id) on delete cascade
);

create table if not exists public.jhadina_relationship_observations (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  entity_id text not null,
  source_ref text not null,
  source_kind text not null,
  field text,
  observed_value jsonb,
  strength text not null check (strength in ('authoritative','strong','supporting','weak')),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  observed_at timestamptz not null,
  primary key (user_id,id),
  foreign key (user_id,entity_id) references public.jhadina_relationship_entities(user_id,id) on delete cascade,
  check (not (payload ? 'confidence' or payload ? 'confidenceScore' or payload ? 'modelConfidence'))
);

create table if not exists public.jhadina_relationship_facts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  entity_id text not null,
  field text not null,
  value jsonb,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array' and jsonb_array_length(evidence_refs)>0),
  status text not null check (status in ('verified','disputed','superseded')),
  verified_at timestamptz not null,
  primary key (user_id,id),
  foreign key (user_id,entity_id) references public.jhadina_relationship_entities(user_id,id) on delete cascade
);

create table if not exists public.jhadina_relationship_fact_suggestions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  entity_id text not null,
  field text not null,
  proposed_value jsonb,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array' and jsonb_array_length(evidence_refs)>0),
  reason text not null,
  status text not null check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null,
  primary key (user_id,id),
  foreign key (user_id,entity_id) references public.jhadina_relationship_entities(user_id,id) on delete cascade
);

create table if not exists public.jhadina_relationship_activities (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  entity_id text not null,
  activity_type text not null,
  occurred_at timestamptz not null,
  context_ref text,
  summary text not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array' and jsonb_array_length(evidence_refs)>0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  primary key (user_id,id),
  foreign key (user_id,entity_id) references public.jhadina_relationship_entities(user_id,id) on delete cascade
);

create table if not exists public.jhadina_relationship_context_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  entity_id text not null,
  context_kind text not null,
  context_ref text not null,
  relation text not null,
  occurred_at timestamptz not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs)='array' and jsonb_array_length(evidence_refs)>0),
  primary key (user_id,id),
  foreign key (user_id,entity_id) references public.jhadina_relationship_entities(user_id,id) on delete cascade,
  unique (user_id,entity_id,context_kind,context_ref,relation)
);

create table if not exists public.jhadina_relationship_object_definitions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  definition jsonb not null check (jsonb_typeof(definition)='object'),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);

create table if not exists public.jhadina_relationship_pipelines (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  object_definition_id text not null,
  definition jsonb not null check (jsonb_typeof(definition)='object'),
  updated_at timestamptz not null default now(),
  primary key (user_id,id),
  foreign key (user_id,object_definition_id) references public.jhadina_relationship_object_definitions(user_id,id) on delete cascade
);

create table if not exists public.jhadina_relationship_pipeline_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  entity_id text not null,
  pipeline_id text not null,
  stage_id text not null,
  values_json jsonb not null default '{}'::jsonb check (jsonb_typeof(values_json)='object'),
  updated_at timestamptz not null,
  primary key (user_id,id),
  foreign key (user_id,entity_id) references public.jhadina_relationship_entities(user_id,id) on delete cascade,
  foreign key (user_id,pipeline_id) references public.jhadina_relationship_pipelines(user_id,id) on delete cascade
);

create table if not exists public.jhadina_relationship_work_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  capability text not null,
  entity_ref text not null,
  reason text not null,
  due_at timestamptz not null,
  priority integer not null default 0,
  status text not null check (status in ('pending','leased','completed','cancelled')),
  lease_owner text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count>=0),
  budget integer check (budget is null or budget>=0),
  correlation_id text not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  last_error text,
  execution_authorized boolean not null default false check (execution_authorized=false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);

create index if not exists jhadina_relationship_activity_timeline_idx on public.jhadina_relationship_activities(user_id,entity_id,occurred_at desc);
create index if not exists jhadina_relationship_context_idx on public.jhadina_relationship_context_links(user_id,entity_id,occurred_at desc);
create index if not exists jhadina_relationship_due_work_idx on public.jhadina_relationship_work_items(user_id,status,due_at,priority desc);
create index if not exists jhadina_relationship_roles_idx on public.jhadina_relationship_roles(user_id,entity_id,domain,role);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'jhadina_relationship_entities','jhadina_relationship_identities','jhadina_relationship_roles',
    'jhadina_relationship_observations','jhadina_relationship_facts','jhadina_relationship_fact_suggestions',
    'jhadina_relationship_activities','jhadina_relationship_context_links','jhadina_relationship_object_definitions',
    'jhadina_relationship_pipelines','jhadina_relationship_pipeline_records','jhadina_relationship_work_items'
  ] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_select_own',table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid())=user_id)',table_name||'_select_own',table_name);
    execute format('revoke insert,update,delete on public.%I from anon,authenticated',table_name);
    execute format('grant select on public.%I to authenticated',table_name);
    execute format('grant all on public.%I to service_role',table_name);
  end loop;
end;
$$;

create or replace function public.jhadina_relationship_claim_due_work(
  p_user_id uuid,p_worker_id text,p_now timestamptz,p_lease_seconds integer,p_limit integer
)
returns setof public.jhadina_relationship_work_items
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if coalesce(p_worker_id,'')='' then raise exception 'worker id required'; end if;
  if p_lease_seconds<1 or p_lease_seconds>3600 then raise exception 'invalid lease seconds'; end if;
  if p_limit<1 or p_limit>100 then raise exception 'invalid claim limit'; end if;
  return query
  with candidates as (
    select w.user_id,w.id from public.jhadina_relationship_work_items w
    where w.user_id=p_user_id and (
      (w.status='pending' and w.due_at<=p_now) or
      (w.status='leased' and w.lease_expires_at<=p_now)
    )
    order by w.priority desc,w.due_at asc,w.id asc
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.jhadina_relationship_work_items w
    set status='leased',lease_owner=p_worker_id,
        lease_expires_at=p_now+make_interval(secs=>p_lease_seconds),
        attempt_count=w.attempt_count+1,updated_at=p_now
    from candidates c where w.user_id=c.user_id and w.id=c.id
    returning w.*
  )
  select * from claimed;
end;
$$;

create or replace function public.jhadina_relationship_complete_work(
  p_user_id uuid,p_item_id text,p_worker_id text,p_completed_at timestamptz
)
returns void language plpgsql security definer set search_path=public,pg_temp
as $$
declare updated_count integer;
begin
  update public.jhadina_relationship_work_items
  set status='completed',lease_owner=null,lease_expires_at=null,last_error=null,updated_at=p_completed_at
  where user_id=p_user_id and id=p_item_id and status='leased' and lease_owner=p_worker_id;
  get diagnostics updated_count=row_count;
  if updated_count<>1 then raise exception 'relationship work lease mismatch'; end if;
end;
$$;

revoke all on function public.jhadina_relationship_claim_due_work(uuid,text,timestamptz,integer,integer) from public,anon,authenticated;
grant execute on function public.jhadina_relationship_claim_due_work(uuid,text,timestamptz,integer,integer) to service_role;
revoke all on function public.jhadina_relationship_complete_work(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.jhadina_relationship_complete_work(uuid,text,text,timestamptz) to service_role;
