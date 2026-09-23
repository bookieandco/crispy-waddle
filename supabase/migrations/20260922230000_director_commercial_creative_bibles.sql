-- Durable Director commercial creative truth.
-- Product/style truth and creative lineage are project-scoped and service-role only.

create table if not exists public.director_product_bibles (
  id text primary key,
  project_id text not null,
  product_id text not null,
  canonical_variant_id text not null,
  bible jsonb not null,
  approved_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, product_id, canonical_variant_id)
);

create table if not exists public.director_visual_style_bibles (
  id text primary key,
  project_id text not null,
  bible jsonb not null,
  approved_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.director_commercial_creatives (
  id text primary key,
  project_id text not null,
  product_bible_id text not null references public.director_product_bibles(id) on delete restrict,
  style_bible_id text not null references public.director_visual_style_bibles(id) on delete restrict,
  concept jsonb not null,
  source_content_project_id text,
  source_social_asset_id text,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.director_ad_multiplier_plans (
  id text primary key,
  project_id text not null,
  source_creative_id text not null references public.director_commercial_creatives(id) on delete restrict,
  plan jsonb not null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists director_product_bibles_project_idx
  on public.director_product_bibles(project_id, product_id);
create index if not exists director_visual_style_bibles_project_idx
  on public.director_visual_style_bibles(project_id, created_at desc);
create index if not exists director_commercial_creatives_project_idx
  on public.director_commercial_creatives(project_id, created_at desc);
create index if not exists director_ad_multiplier_plans_project_idx
  on public.director_ad_multiplier_plans(project_id, created_at desc);

alter table public.director_product_bibles enable row level security;
alter table public.director_visual_style_bibles enable row level security;
alter table public.director_commercial_creatives enable row level security;
alter table public.director_ad_multiplier_plans enable row level security;

revoke all on public.director_product_bibles from public,anon,authenticated;
revoke all on public.director_visual_style_bibles from public,anon,authenticated;
revoke all on public.director_commercial_creatives from public,anon,authenticated;
revoke all on public.director_ad_multiplier_plans from public,anon,authenticated;

grant select,insert,update,delete on public.director_product_bibles to service_role;
grant select,insert,update,delete on public.director_visual_style_bibles to service_role;
grant select,insert,update,delete on public.director_commercial_creatives to service_role;
grant select,insert,update,delete on public.director_ad_multiplier_plans to service_role;

drop policy if exists director_product_bibles_service_role_only on public.director_product_bibles;
create policy director_product_bibles_service_role_only
  on public.director_product_bibles as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_visual_style_bibles_service_role_only on public.director_visual_style_bibles;
create policy director_visual_style_bibles_service_role_only
  on public.director_visual_style_bibles as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_commercial_creatives_service_role_only on public.director_commercial_creatives;
create policy director_commercial_creatives_service_role_only
  on public.director_commercial_creatives as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_ad_multiplier_plans_service_role_only on public.director_ad_multiplier_plans;
create policy director_ad_multiplier_plans_service_role_only
  on public.director_ad_multiplier_plans as restrictive for all to service_role
  using (true) with check (true);

create or replace function public.assert_director_commercial_authority()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  actor uuid;
  role_value text;
begin
  actor := case tg_table_name
    when 'director_product_bibles' then new.approved_by_user_id
    when 'director_visual_style_bibles' then new.approved_by_user_id
    else new.created_by_user_id
  end;

  select role into role_value
  from public.director_project_memberships
  where project_id=new.project_id and user_id=actor;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director commercial creative mutation requires project edit authority';
  end if;

  if tg_op='UPDATE' and old.project_id<>new.project_id then
    raise exception 'Director commercial project identity is immutable';
  end if;

  if tg_table_name='director_product_bibles'
     and tg_op='UPDATE'
     and (
       old.product_id<>new.product_id
       or old.canonical_variant_id<>new.canonical_variant_id
       or old.bible is distinct from new.bible
     ) then
    raise exception 'Director product bible identity is immutable';
  end if;

  if tg_table_name='director_visual_style_bibles'
     and tg_op='UPDATE'
     and old.bible is distinct from new.bible then
    raise exception 'Director visual style bible identity is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists director_product_bibles_authority_guard on public.director_product_bibles;
create trigger director_product_bibles_authority_guard
before insert or update on public.director_product_bibles
for each row execute function public.assert_director_commercial_authority();

drop trigger if exists director_visual_style_bibles_authority_guard on public.director_visual_style_bibles;
create trigger director_visual_style_bibles_authority_guard
before insert or update on public.director_visual_style_bibles
for each row execute function public.assert_director_commercial_authority();

drop trigger if exists director_commercial_creatives_authority_guard on public.director_commercial_creatives;
create trigger director_commercial_creatives_authority_guard
before insert or update on public.director_commercial_creatives
for each row execute function public.assert_director_commercial_authority();

drop trigger if exists director_ad_multiplier_plans_authority_guard on public.director_ad_multiplier_plans;
create trigger director_ad_multiplier_plans_authority_guard
before insert or update on public.director_ad_multiplier_plans
for each row execute function public.assert_director_commercial_authority();

create or replace function public.save_director_commercial_creative_bundle(
  p_user_id uuid,
  p_project_id text,
  p_product_bible_id text,
  p_style_bible jsonb,
  p_concept jsonb,
  p_source_content_project_id text,
  p_source_social_asset_id text,
  p_now timestamptz
)
returns public.director_commercial_creatives
language plpgsql
security invoker
set search_path=public
as $$
declare
  role_value text;
  result_row public.director_commercial_creatives%rowtype;
  persisted_product_bible public.director_product_bibles%rowtype;
  persisted_style_bible jsonb;
begin
  select role into role_value
  from public.director_project_memberships
  where project_id=p_project_id and user_id=p_user_id;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director commercial creative requires project edit authority';
  end if;

  select * into persisted_product_bible
  from public.director_product_bibles
  where id=p_product_bible_id
    and project_id=p_project_id;

  if persisted_product_bible.id is null then
    raise exception 'Director persisted product bible not found';
  end if;

  if p_style_bible->>'projectId' <> p_project_id
     or p_concept->>'projectId' <> p_project_id then
    raise exception 'Director commercial creative project mismatch';
  end if;

  if p_concept->>'productBibleId' <> p_product_bible_id
     or p_concept->>'styleBibleId' <> p_style_bible->>'id' then
    raise exception 'Director commercial creative bible mismatch';
  end if;

  if exists (
    select 1
    from public.director_visual_style_bibles
    where id=p_style_bible->>'id'
      and project_id<>p_project_id
  ) then
    raise exception 'Director style bible project identity mismatch';
  end if;

  select bible into persisted_style_bible
  from public.director_visual_style_bibles
  where id=p_style_bible->>'id'
    and project_id=p_project_id;

  if persisted_style_bible is not null
     and persisted_style_bible is distinct from p_style_bible then
    raise exception 'Director visual style bible id already exists with different content';
  end if;

  insert into public.director_visual_style_bibles(
    id,project_id,bible,approved_by_user_id,created_at,updated_at
  ) values(
    p_style_bible->>'id',
    p_project_id,
    p_style_bible,
    p_user_id,
    p_now,
    p_now
  )
  on conflict(id) do nothing;

  insert into public.director_commercial_creatives(
    id,project_id,product_bible_id,style_bible_id,concept,
    source_content_project_id,source_social_asset_id,
    created_by_user_id,created_at,updated_at
  ) values(
    p_concept->>'id',
    p_project_id,
    p_product_bible_id,
    p_style_bible->>'id',
    p_concept,
    nullif(p_source_content_project_id,''),
    nullif(p_source_social_asset_id,''),
    p_user_id,
    p_now,
    p_now
  )
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.save_director_commercial_creative_bundle(
  uuid,text,text,jsonb,jsonb,text,text,timestamptz
) from public,anon,authenticated;
grant execute on function public.save_director_commercial_creative_bundle(
  uuid,text,text,jsonb,jsonb,text,text,timestamptz
) to service_role;
