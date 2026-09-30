create table if not exists public.jhadina_growth_presence_campaigns (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  brand_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  content_project_id text,
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

comment on table public.jhadina_growth_presence_campaigns is
  'Owner-scoped durable Social/Growth marketing presence campaigns. Planning state only; grants no publish, spend, outreach, or purchase authority.';

create table if not exists public.jhadina_growth_presence_observations (
  user_id uuid not null,
  id text not null,
  campaign_id text not null,
  surface text not null,
  query_or_context text not null,
  observed_at timestamptz not null,
  outcome text not null check (outcome in (
    'mentioned','cited','visited','streamed','added_to_cart','purchased','signed_up','not_observed'
  )),
  source_locator text,
  value numeric,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, campaign_id)
    references public.jhadina_growth_presence_campaigns(user_id, id)
    on delete cascade
);

comment on table public.jhadina_growth_presence_observations is
  'Evidence-backed observations for presence campaigns. Mentions/citations remain distinct from visits, streams, carts, purchases, and signups.';

create table if not exists public.jhadina_social_content_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  brand text not null,
  authority_position_ref text not null,
  pillar_ref text not null,
  big_idea_ref text not null,
  primary_job text not null check (primary_job in ('trust','reach','useful','conversion')),
  origin text not null check (origin in (
    'human_spoken','human_written','interview','customer_evidence',
    'operational_evidence','research_synthesis','ai_generated'
  )),
  presence_campaign_id text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

comment on table public.jhadina_social_content_projects is
  'Durable Social Content Project lineage. Stores planning/content lineage only and grants no publication authority.';

create index if not exists jhadina_growth_presence_campaigns_user_updated_idx
  on public.jhadina_growth_presence_campaigns(user_id, updated_at desc);

create index if not exists jhadina_growth_presence_observations_campaign_time_idx
  on public.jhadina_growth_presence_observations(user_id, campaign_id, observed_at desc);

create index if not exists jhadina_social_content_projects_user_updated_idx
  on public.jhadina_social_content_projects(user_id, updated_at desc);

create index if not exists jhadina_social_content_projects_presence_idx
  on public.jhadina_social_content_projects(user_id, presence_campaign_id)
  where presence_campaign_id is not null;

alter table public.jhadina_growth_presence_campaigns enable row level security;
alter table public.jhadina_growth_presence_observations enable row level security;
alter table public.jhadina_social_content_projects enable row level security;

revoke all on table public.jhadina_growth_presence_campaigns from anon;
revoke all on table public.jhadina_growth_presence_observations from anon;
revoke all on table public.jhadina_social_content_projects from anon;

grant select, insert, update on table public.jhadina_growth_presence_campaigns to authenticated;
grant select, insert, update on table public.jhadina_growth_presence_observations to authenticated;
grant select, insert, update on table public.jhadina_social_content_projects to authenticated;

drop policy if exists growth_presence_campaign_owner_select on public.jhadina_growth_presence_campaigns;
create policy growth_presence_campaign_owner_select
  on public.jhadina_growth_presence_campaigns
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists growth_presence_campaign_owner_insert on public.jhadina_growth_presence_campaigns;
create policy growth_presence_campaign_owner_insert
  on public.jhadina_growth_presence_campaigns
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists growth_presence_campaign_owner_update on public.jhadina_growth_presence_campaigns;
create policy growth_presence_campaign_owner_update
  on public.jhadina_growth_presence_campaigns
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists growth_presence_observation_owner_select on public.jhadina_growth_presence_observations;
create policy growth_presence_observation_owner_select
  on public.jhadina_growth_presence_observations
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists growth_presence_observation_owner_insert on public.jhadina_growth_presence_observations;
create policy growth_presence_observation_owner_insert
  on public.jhadina_growth_presence_observations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists growth_presence_observation_owner_update on public.jhadina_growth_presence_observations;
create policy growth_presence_observation_owner_update
  on public.jhadina_growth_presence_observations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists social_content_project_owner_select on public.jhadina_social_content_projects;
create policy social_content_project_owner_select
  on public.jhadina_social_content_projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists social_content_project_owner_insert on public.jhadina_social_content_projects;
create policy social_content_project_owner_insert
  on public.jhadina_social_content_projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists social_content_project_owner_update on public.jhadina_social_content_projects;
create policy social_content_project_owner_update
  on public.jhadina_social_content_projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
