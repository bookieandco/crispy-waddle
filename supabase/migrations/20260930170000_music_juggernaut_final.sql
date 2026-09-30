-- MUSIC-JUGGERNAUT.FINAL durable artist-growth intelligence.
-- Music-specific state only. Generic customers, paid campaigns, attribution and spend authority
-- remain canonical in the existing Growth production spine.

create schema if not exists music_private;
revoke all on schema music_private from public;
grant usage on schema music_private to authenticated;

create table if not exists public.jhadina_music_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_key text not null,
  name text not null,
  mode text not null default 'SEARCH' check (mode in ('SEARCH','ATTACK')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,artist_key)
);

create table if not exists public.jhadina_music_song_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  song_key text not null,
  title text not null,
  release_status text not null check (release_status in ('unreleased','released','catalog')),
  campaign_state text not null default 'INGESTED' check (campaign_state in (
    'INGESTED','EXPLORING','EARLY_SIGNAL','VALIDATING','PROVEN','SCALING',
    'STEADY_STATE','REPACKAGE','CAPITAL_STOP','CATALOG_HOLD','RESURRECTED'
  )),
  artist_conviction numeric not null default 0.5 check (artist_conviction>=0 and artist_conviction<=1),
  rights_state text not null default 'review_required' check (rights_state in ('clear','review_required','blocked')),
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections)='array'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  release_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,song_key)
);

create table if not exists public.jhadina_music_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  song_id uuid not null references public.jhadina_music_song_campaigns(id) on delete cascade,
  experiment_key text not null,
  section_key text,
  hypothesis text not null,
  content_family text not null,
  platform text not null,
  audience text,
  spend_minor bigint not null default 0 check (spend_minor>=0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  sample_target integer not null check (sample_target>0),
  success_signal text not null,
  failure_signal text not null,
  status text not null default 'planned' check (status in ('planned','running','complete','stopped')),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,experiment_key)
);

create table if not exists public.jhadina_music_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  experiment_id uuid not null references public.jhadina_music_experiments(id) on delete cascade,
  observation_key text not null,
  exposures bigint not null default 0 check (exposures>=0),
  views bigint not null default 0 check (views>=0),
  engaged_views bigint check (engaged_views is null or engaged_views>=0),
  shares bigint not null default 0 check (shares>=0),
  saves bigint not null default 0 check (saves>=0),
  comments bigint not null default 0 check (comments>=0),
  profile_visits bigint not null default 0 check (profile_visits>=0),
  song_actions bigint not null default 0 check (song_actions>=0),
  direct_fan_captures bigint not null default 0 check (direct_fan_captures>=0),
  purchases bigint check (purchases is null or purchases>=0),
  revenue_minor bigint check (revenue_minor is null or revenue_minor>=0),
  bot_risk numeric not null default 0 check (bot_risk>=0 and bot_risk<=1),
  attribution_confidence numeric not null default 0.5 check (attribution_confidence>=0 and attribution_confidence<=1),
  observed_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  created_at timestamptz not null default now(),
  unique(user_id,project_id,observation_key)
);

create table if not exists public.jhadina_music_city_demand (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  city_key text not null,
  city_name text not null,
  listeners bigint not null default 0 check (listeners>=0),
  direct_fans bigint not null default 0 check (direct_fans>=0),
  show_interest bigint not null default 0 check (show_interest>=0),
  prior_attendees bigint not null default 0 check (prior_attendees>=0),
  repeat_fans bigint not null default 0 check (repeat_fans>=0),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,city_key)
);

create table if not exists public.jhadina_music_rights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  asset_key text not null,
  master_ownership_known boolean not null default false,
  publishing_known boolean not null default false,
  sample_status text not null default 'review_required' check (sample_status in ('none','cleared','review_required','blocked')),
  third_party_usage_status text not null default 'review_required' check (third_party_usage_status in ('none','cleared','review_required','blocked')),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,asset_key)
);

create table if not exists public.jhadina_music_learning (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.jhadina_music_projects(id) on delete cascade,
  learning_key text not null,
  status text not null check (status in ('provisional','validated','rejected')),
  confidence numeric not null check (confidence>=0 and confidence<=1),
  finding text not null,
  reusable_signals jsonb not null default '{}'::jsonb check (jsonb_typeof(reusable_signals)='object'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id,learning_key)
);

create index if not exists jhadina_music_project_owner_idx on public.jhadina_music_projects(user_id,artist_key);
create index if not exists jhadina_music_song_project_idx on public.jhadina_music_song_campaigns(user_id,project_id,campaign_state);
create index if not exists jhadina_music_experiment_project_idx on public.jhadina_music_experiments(user_id,project_id,status);
create index if not exists jhadina_music_observation_project_idx on public.jhadina_music_observations(user_id,project_id,observed_at desc);
create index if not exists jhadina_music_city_project_idx on public.jhadina_music_city_demand(user_id,project_id,show_interest desc);
create index if not exists jhadina_music_learning_project_idx on public.jhadina_music_learning(user_id,project_id,status,updated_at desc);

do $$
declare t text;
begin
  foreach t in array array[
    'jhadina_music_projects','jhadina_music_song_campaigns','jhadina_music_experiments',
    'jhadina_music_observations','jhadina_music_city_demand','jhadina_music_rights','jhadina_music_learning'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      'music_juggernaut_owner_read_'||t,t
    );
  end loop;
end $$;

create or replace function music_private.upsert_project(p_artist_key text,p_name text,p_mode text default 'SEARCH',p_metadata jsonb default '{}'::jsonb)
returns public.jhadina_music_projects language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_projects;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_artist_key),'') is null or nullif(trim(p_name),'') is null then raise exception 'artist key and name required'; end if;
  insert into public.jhadina_music_projects(user_id,artist_key,name,mode,metadata)
  values(v_user,trim(p_artist_key),trim(p_name),p_mode,coalesce(p_metadata,'{}'::jsonb))
  on conflict(user_id,artist_key) do update set name=excluded.name,mode=excluded.mode,metadata=excluded.metadata,updated_at=now()
  returning * into v_row; return v_row;
end $$;

create or replace function public.jhadina_music_upsert_project(p_artist_key text,p_name text,p_mode text default 'SEARCH',p_metadata jsonb default '{}'::jsonb)
returns public.jhadina_music_projects language sql security invoker set search_path='' as $$
  select * from music_private.upsert_project(p_artist_key,p_name,p_mode,p_metadata)
$$;

create or replace function music_private.upsert_song(
  p_project_id uuid,p_song_key text,p_title text,p_release_status text,p_campaign_state text,
  p_artist_conviction numeric,p_rights_state text,p_sections jsonb,p_evidence_refs jsonb,p_release_date date default null
) returns public.jhadina_music_song_campaigns language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_song_campaigns;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_projects where id=p_project_id and user_id=v_user) then raise exception 'project not found'; end if;
  insert into public.jhadina_music_song_campaigns(user_id,project_id,song_key,title,release_status,campaign_state,artist_conviction,rights_state,sections,evidence_refs,release_date)
  values(v_user,p_project_id,trim(p_song_key),trim(p_title),p_release_status,p_campaign_state,p_artist_conviction,p_rights_state,coalesce(p_sections,'[]'::jsonb),coalesce(p_evidence_refs,'[]'::jsonb),p_release_date)
  on conflict(user_id,project_id,song_key) do update set
    title=excluded.title,release_status=excluded.release_status,campaign_state=excluded.campaign_state,
    artist_conviction=excluded.artist_conviction,rights_state=excluded.rights_state,sections=excluded.sections,
    evidence_refs=excluded.evidence_refs,release_date=excluded.release_date,updated_at=now()
  returning * into v_row; return v_row;
end $$;

create or replace function public.jhadina_music_upsert_song(
  p_project_id uuid,p_song_key text,p_title text,p_release_status text,p_campaign_state text,
  p_artist_conviction numeric,p_rights_state text,p_sections jsonb,p_evidence_refs jsonb,p_release_date date default null
) returns public.jhadina_music_song_campaigns language sql security invoker set search_path='' as $$
  select * from music_private.upsert_song(p_project_id,p_song_key,p_title,p_release_status,p_campaign_state,p_artist_conviction,p_rights_state,p_sections,p_evidence_refs,p_release_date)
$$;

create or replace function music_private.upsert_experiment(
  p_project_id uuid,p_song_id uuid,p_experiment_key text,p_section_key text,p_hypothesis text,p_content_family text,
  p_platform text,p_audience text,p_spend_minor bigint,p_currency text,p_sample_target integer,
  p_success_signal text,p_failure_signal text,p_status text,p_evidence_refs jsonb
) returns public.jhadina_music_experiments language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_experiments;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_song_campaigns where id=p_song_id and project_id=p_project_id and user_id=v_user) then raise exception 'song not found'; end if;
  insert into public.jhadina_music_experiments(user_id,project_id,song_id,experiment_key,section_key,hypothesis,content_family,platform,audience,spend_minor,currency,sample_target,success_signal,failure_signal,status,evidence_refs)
  values(v_user,p_project_id,p_song_id,trim(p_experiment_key),p_section_key,trim(p_hypothesis),trim(p_content_family),trim(p_platform),p_audience,p_spend_minor,p_currency,p_sample_target,trim(p_success_signal),trim(p_failure_signal),p_status,coalesce(p_evidence_refs,'[]'::jsonb))
  on conflict(user_id,project_id,experiment_key) do update set
    section_key=excluded.section_key,hypothesis=excluded.hypothesis,content_family=excluded.content_family,platform=excluded.platform,
    audience=excluded.audience,spend_minor=excluded.spend_minor,currency=excluded.currency,sample_target=excluded.sample_target,
    success_signal=excluded.success_signal,failure_signal=excluded.failure_signal,status=excluded.status,evidence_refs=excluded.evidence_refs,updated_at=now()
  returning * into v_row; return v_row;
end $$;

create or replace function public.jhadina_music_upsert_experiment(
  p_project_id uuid,p_song_id uuid,p_experiment_key text,p_section_key text,p_hypothesis text,p_content_family text,
  p_platform text,p_audience text,p_spend_minor bigint,p_currency text,p_sample_target integer,
  p_success_signal text,p_failure_signal text,p_status text,p_evidence_refs jsonb
) returns public.jhadina_music_experiments language sql security invoker set search_path='' as $$
  select * from music_private.upsert_experiment(p_project_id,p_song_id,p_experiment_key,p_section_key,p_hypothesis,p_content_family,p_platform,p_audience,p_spend_minor,p_currency,p_sample_target,p_success_signal,p_failure_signal,p_status,p_evidence_refs)
$$;

create or replace function music_private.record_observation(
  p_project_id uuid,p_experiment_id uuid,p_observation_key text,p_observed_at timestamptz,p_metrics jsonb,
  p_bot_risk numeric,p_attribution_confidence numeric,p_evidence_refs jsonb
) returns public.jhadina_music_observations language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_observations;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_experiments where id=p_experiment_id and project_id=p_project_id and user_id=v_user) then raise exception 'experiment not found'; end if;
  insert into public.jhadina_music_observations(
    user_id,project_id,experiment_id,observation_key,exposures,views,engaged_views,shares,saves,comments,profile_visits,
    song_actions,direct_fan_captures,purchases,revenue_minor,bot_risk,attribution_confidence,observed_at,evidence_refs
  ) values (
    v_user,p_project_id,p_experiment_id,trim(p_observation_key),
    coalesce((p_metrics->>'exposures')::bigint,0),coalesce((p_metrics->>'views')::bigint,0),(p_metrics->>'engagedViews')::bigint,
    coalesce((p_metrics->>'shares')::bigint,0),coalesce((p_metrics->>'saves')::bigint,0),coalesce((p_metrics->>'comments')::bigint,0),
    coalesce((p_metrics->>'profileVisits')::bigint,0),coalesce((p_metrics->>'songActions')::bigint,0),coalesce((p_metrics->>'directFanCaptures')::bigint,0),
    (p_metrics->>'purchases')::bigint,(p_metrics->>'revenueMinor')::bigint,p_bot_risk,p_attribution_confidence,p_observed_at,coalesce(p_evidence_refs,'[]'::jsonb)
  )
  on conflict(user_id,project_id,observation_key) do update set
    exposures=excluded.exposures,views=excluded.views,engaged_views=excluded.engaged_views,shares=excluded.shares,saves=excluded.saves,
    comments=excluded.comments,profile_visits=excluded.profile_visits,song_actions=excluded.song_actions,direct_fan_captures=excluded.direct_fan_captures,
    purchases=excluded.purchases,revenue_minor=excluded.revenue_minor,bot_risk=excluded.bot_risk,attribution_confidence=excluded.attribution_confidence,
    observed_at=excluded.observed_at,evidence_refs=excluded.evidence_refs
  returning * into v_row; return v_row;
end $$;

create or replace function public.jhadina_music_record_observation(
  p_project_id uuid,p_experiment_id uuid,p_observation_key text,p_observed_at timestamptz,p_metrics jsonb,
  p_bot_risk numeric,p_attribution_confidence numeric,p_evidence_refs jsonb
) returns public.jhadina_music_observations language sql security invoker set search_path='' as $$
  select * from music_private.record_observation(p_project_id,p_experiment_id,p_observation_key,p_observed_at,p_metrics,p_bot_risk,p_attribution_confidence,p_evidence_refs)
$$;

create or replace function music_private.upsert_city_demand(
  p_project_id uuid,p_city_key text,p_city_name text,p_listeners bigint,p_direct_fans bigint,p_show_interest bigint,
  p_prior_attendees bigint,p_repeat_fans bigint,p_evidence_refs jsonb,p_observed_at timestamptz
) returns public.jhadina_music_city_demand language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_city_demand;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_projects where id=p_project_id and user_id=v_user) then raise exception 'project not found'; end if;
  insert into public.jhadina_music_city_demand(user_id,project_id,city_key,city_name,listeners,direct_fans,show_interest,prior_attendees,repeat_fans,evidence_refs,observed_at)
  values(v_user,p_project_id,trim(p_city_key),trim(p_city_name),p_listeners,p_direct_fans,p_show_interest,p_prior_attendees,p_repeat_fans,coalesce(p_evidence_refs,'[]'::jsonb),p_observed_at)
  on conflict(user_id,project_id,city_key) do update set
    city_name=excluded.city_name,listeners=excluded.listeners,direct_fans=excluded.direct_fans,show_interest=excluded.show_interest,
    prior_attendees=excluded.prior_attendees,repeat_fans=excluded.repeat_fans,evidence_refs=excluded.evidence_refs,observed_at=excluded.observed_at,updated_at=now()
  returning * into v_row; return v_row;
end $$;

create or replace function public.jhadina_music_upsert_city_demand(
  p_project_id uuid,p_city_key text,p_city_name text,p_listeners bigint,p_direct_fans bigint,p_show_interest bigint,
  p_prior_attendees bigint,p_repeat_fans bigint,p_evidence_refs jsonb,p_observed_at timestamptz
) returns public.jhadina_music_city_demand language sql security invoker set search_path='' as $$
  select * from music_private.upsert_city_demand(p_project_id,p_city_key,p_city_name,p_listeners,p_direct_fans,p_show_interest,p_prior_attendees,p_repeat_fans,p_evidence_refs,p_observed_at)
$$;

create or replace function music_private.upsert_rights(
  p_project_id uuid,p_asset_key text,p_master_ownership_known boolean,p_publishing_known boolean,
  p_sample_status text,p_third_party_usage_status text,p_evidence_refs jsonb
) returns public.jhadina_music_rights language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_rights;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_projects where id=p_project_id and user_id=v_user) then raise exception 'project not found'; end if;
  insert into public.jhadina_music_rights(user_id,project_id,asset_key,master_ownership_known,publishing_known,sample_status,third_party_usage_status,evidence_refs)
  values(v_user,p_project_id,trim(p_asset_key),p_master_ownership_known,p_publishing_known,p_sample_status,p_third_party_usage_status,coalesce(p_evidence_refs,'[]'::jsonb))
  on conflict(user_id,project_id,asset_key) do update set
    master_ownership_known=excluded.master_ownership_known,publishing_known=excluded.publishing_known,sample_status=excluded.sample_status,
    third_party_usage_status=excluded.third_party_usage_status,evidence_refs=excluded.evidence_refs,updated_at=now()
  returning * into v_row; return v_row;
end $$;

create or replace function public.jhadina_music_upsert_rights(
  p_project_id uuid,p_asset_key text,p_master_ownership_known boolean,p_publishing_known boolean,
  p_sample_status text,p_third_party_usage_status text,p_evidence_refs jsonb
) returns public.jhadina_music_rights language sql security invoker set search_path='' as $$
  select * from music_private.upsert_rights(p_project_id,p_asset_key,p_master_ownership_known,p_publishing_known,p_sample_status,p_third_party_usage_status,p_evidence_refs)
$$;

create or replace function music_private.upsert_learning(
  p_project_id uuid,p_learning_key text,p_status text,p_confidence numeric,p_finding text,
  p_reusable_signals jsonb,p_evidence_refs jsonb
) returns public.jhadina_music_learning language plpgsql security definer set search_path='' as $
declare v_user uuid:=auth.uid(); v_row public.jhadina_music_learning;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.jhadina_music_projects where id=p_project_id and user_id=v_user) then raise exception 'project not found'; end if;
  if p_confidence < 0 or p_confidence > 1 then raise exception 'confidence out of range'; end if;
  insert into public.jhadina_music_learning(user_id,project_id,learning_key,status,confidence,finding,reusable_signals,evidence_refs)
  values(v_user,p_project_id,trim(p_learning_key),p_status,p_confidence,trim(p_finding),coalesce(p_reusable_signals,'{}'::jsonb),coalesce(p_evidence_refs,'[]'::jsonb))
  on conflict(user_id,project_id,learning_key) do update set
    status=excluded.status,confidence=excluded.confidence,finding=excluded.finding,reusable_signals=excluded.reusable_signals,
    evidence_refs=excluded.evidence_refs,updated_at=now()
  returning * into v_row; return v_row;
end $;

create or replace function public.jhadina_music_upsert_learning(
  p_project_id uuid,p_learning_key text,p_status text,p_confidence numeric,p_finding text,
  p_reusable_signals jsonb,p_evidence_refs jsonb
) returns public.jhadina_music_learning language sql security invoker set search_path='' as $
  select * from music_private.upsert_learning(p_project_id,p_learning_key,p_status,p_confidence,p_finding,p_reusable_signals,p_evidence_refs)
$;

revoke all on all functions in schema music_private from public;
grant execute on all functions in schema music_private to authenticated;
revoke execute on function public.jhadina_music_upsert_project(text,text,text,jsonb) from public,anon;
revoke execute on function public.jhadina_music_upsert_song(uuid,text,text,text,text,numeric,text,jsonb,jsonb,date) from public,anon;
revoke execute on function public.jhadina_music_upsert_experiment(uuid,uuid,text,text,text,text,text,text,bigint,text,integer,text,text,text,jsonb) from public,anon;
revoke execute on function public.jhadina_music_record_observation(uuid,uuid,text,timestamptz,jsonb,numeric,numeric,jsonb) from public,anon;
revoke execute on function public.jhadina_music_upsert_city_demand(uuid,text,text,bigint,bigint,bigint,bigint,bigint,jsonb,timestamptz) from public,anon;
revoke execute on function public.jhadina_music_upsert_rights(uuid,text,boolean,boolean,text,text,jsonb) from public,anon;\nrevoke execute on function public.jhadina_music_upsert_learning(uuid,text,text,numeric,text,jsonb,jsonb) from public,anon;
grant execute on function public.jhadina_music_upsert_project(text,text,text,jsonb) to authenticated;
grant execute on function public.jhadina_music_upsert_song(uuid,text,text,text,text,numeric,text,jsonb,jsonb,date) to authenticated;
grant execute on function public.jhadina_music_upsert_experiment(uuid,uuid,text,text,text,text,text,text,bigint,text,integer,text,text,text,jsonb) to authenticated;
grant execute on function public.jhadina_music_record_observation(uuid,uuid,text,timestamptz,jsonb,numeric,numeric,jsonb) to authenticated;
grant execute on function public.jhadina_music_upsert_city_demand(uuid,text,text,bigint,bigint,bigint,bigint,bigint,jsonb,timestamptz) to authenticated;
grant execute on function public.jhadina_music_upsert_rights(uuid,text,boolean,boolean,text,text,jsonb) to authenticated;\ngrant execute on function public.jhadina_music_upsert_learning(uuid,text,text,numeric,text,jsonb,jsonb) to authenticated;
