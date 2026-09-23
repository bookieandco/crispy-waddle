-- Durable product-reference bootstrap queue. Uses the shared private
-- director_reference_media_assets quarantine with reference_kind='product'.

create table if not exists public.director_product_bootstrap_jobs (
  id text primary key,
  project_id text not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id text not null,
  display_name text not null,
  reference_asset_ids text[] not null check(cardinality(reference_asset_ids) > 0),
  required_label_text text[] not null default '{}',
  bootstrap_plan jsonb not null,
  product_bible jsonb not null,
  status text not null default 'reference_locked'
    check(status in ('reference_locked','running','ready','blocked','failed','cancelled')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.director_product_bootstrap_events (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.director_product_bootstrap_jobs(id) on delete restrict,
  event_type text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists director_product_bootstrap_queue_idx
  on public.director_product_bootstrap_jobs(status,created_at)
  where status in ('reference_locked','running','blocked');
create index if not exists director_product_bootstrap_events_job_idx
  on public.director_product_bootstrap_events(job_id,created_at);

alter table public.director_product_bootstrap_jobs enable row level security;
alter table public.director_product_bootstrap_events enable row level security;

revoke all on public.director_product_bootstrap_jobs from public,anon,authenticated;
revoke all on public.director_product_bootstrap_events from public,anon,authenticated;
grant select,insert,update on public.director_product_bootstrap_jobs to service_role;
grant select,insert on public.director_product_bootstrap_events to service_role;

drop policy if exists director_product_bootstrap_service_role_only on public.director_product_bootstrap_jobs;
create policy director_product_bootstrap_service_role_only
  on public.director_product_bootstrap_jobs as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_product_bootstrap_events_service_role_only on public.director_product_bootstrap_events;
create policy director_product_bootstrap_events_service_role_only
  on public.director_product_bootstrap_events as restrictive for all to service_role
  using (true) with check (true);

create or replace function public.create_director_product_bootstrap_job(
  p_job_id text,
  p_project_id text,
  p_user_id uuid,
  p_product_id text,
  p_display_name text,
  p_reference_asset_ids text[],
  p_required_label_text text[],
  p_bootstrap_plan jsonb,
  p_product_bible jsonb,
  p_now timestamptz
)
returns public.director_product_bootstrap_jobs
language plpgsql
security definer
set search_path=public
as $$
declare
  role_value text;
  admitted_count integer;
  result_row public.director_product_bootstrap_jobs%rowtype;
begin
  select role into role_value
  from public.director_project_memberships
  where project_id=p_project_id and user_id=p_user_id;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director product bootstrap requires project edit authority';
  end if;

  select count(*) into admitted_count
  from public.director_reference_media_assets
  where project_id=p_project_id
    and reference_kind='product'
    and id=any(p_reference_asset_ids)
    and admission_status='admitted'
    and scan_status='clean';

  if admitted_count <> cardinality(p_reference_asset_ids) then
    raise exception 'All Director product references must be admitted and clean';
  end if;

  if p_product_bible->>'projectId' <> p_project_id
     or p_product_bible->>'productId' <> p_product_id then
    raise exception 'Director product bible identity mismatch';
  end if;

  insert into public.director_product_bibles(
    id,project_id,product_id,canonical_variant_id,bible,approved_by_user_id,created_at,updated_at
  ) values(
    p_product_bible->>'id',
    p_project_id,
    p_product_id,
    p_product_bible->>'canonicalVariantId',
    p_product_bible,
    p_user_id,
    p_now,
    p_now
  );

  insert into public.director_product_bootstrap_jobs(
    id,project_id,user_id,product_id,display_name,reference_asset_ids,
    required_label_text,bootstrap_plan,product_bible,status,created_at,updated_at
  ) values(
    p_job_id,p_project_id,p_user_id,p_product_id,p_display_name,p_reference_asset_ids,
    coalesce(p_required_label_text,'{}'),p_bootstrap_plan,p_product_bible,'reference_locked',p_now,p_now
  )
  returning * into result_row;

  insert into public.director_product_bootstrap_events(job_id,event_type,status,metadata,created_at)
  values(
    p_job_id,'canonical-product-reference-locked','completed',
    jsonb_build_object(
      'productId',p_product_id,
      'productBibleId',p_product_bible->>'id',
      'referenceAssetIds',p_reference_asset_ids
    ),
    p_now
  );

  return result_row;
end;
$$;

revoke all on function public.create_director_product_bootstrap_job(
  text,text,uuid,text,text,text[],text[],jsonb,jsonb,timestamptz
) from public,anon,authenticated;
grant execute on function public.create_director_product_bootstrap_job(
  text,text,uuid,text,text,text[],text[],jsonb,jsonb,timestamptz
) to service_role;
