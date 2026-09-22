-- Movie-scale score/theme continuity, separate from the canonical cast/voice JSON bible.

create table if not exists public.director_score_themes (
  id text primary key,
  project_id text not null,
  name text not null,
  motif_ref text,
  stem_asset_ids text[] not null default '{}',
  instrumentation text[] not null default '{}',
  tempo_bpm numeric,
  musical_key text,
  usage_notes text[] not null default '{}',
  source text not null default 'generated'
    check(source in ('owned','licensed','generated','commissioned')),
  rights_evidence_ids text[] not null default '{}',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.director_scene_score_cues (
  id text primary key,
  project_id text not null,
  scene_id text not null,
  theme_id text references public.director_score_themes(id) on delete restrict,
  start_seconds numeric not null check(start_seconds >= 0),
  end_seconds numeric not null check(end_seconds > start_seconds),
  intensity numeric not null check(intensity between 0 and 1),
  dialogue_priority boolean not null default true,
  dramatic_purpose text not null default 'support scene intent',
  evidence_ids text[] not null default '{}',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists director_score_project_idx
  on public.director_score_themes(project_id, created_at);
create index if not exists director_score_cue_scene_idx
  on public.director_scene_score_cues(project_id, scene_id, start_seconds);

alter table public.director_score_themes enable row level security;
alter table public.director_scene_score_cues enable row level security;
revoke all on public.director_score_themes from public,anon,authenticated;
revoke all on public.director_scene_score_cues from public,anon,authenticated;
grant select,insert,update,delete on public.director_score_themes to service_role;
grant select,insert,update,delete on public.director_scene_score_cues to service_role;

drop policy if exists director_score_themes_service_role_only on public.director_score_themes;
create policy director_score_themes_service_role_only
  on public.director_score_themes as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_scene_score_cues_service_role_only on public.director_scene_score_cues;
create policy director_scene_score_cues_service_role_only
  on public.director_scene_score_cues as restrictive for all to service_role
  using (true) with check (true);

create or replace function public.assert_director_score_authority()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  actor uuid;
  role_value text;
  theme_project_id text;
begin
  actor := new.created_by_user_id;
  if actor is null then raise exception 'Director score actor required'; end if;

  select role into role_value
  from public.director_project_memberships
  where project_id=new.project_id and user_id=actor;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director score mutation requires project edit authority';
  end if;

  if tg_table_name='director_scene_score_cues' and new.theme_id is not null then
    select project_id into theme_project_id
    from public.director_score_themes
    where id=new.theme_id;
    if theme_project_id is null or theme_project_id<>new.project_id then
      raise exception 'Director score cue theme project mismatch';
    end if;
  end if;

  if tg_op='UPDATE' and old.project_id<>new.project_id then
    raise exception 'Director score project identity is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists director_score_themes_authority_guard on public.director_score_themes;
create trigger director_score_themes_authority_guard
before insert or update on public.director_score_themes
for each row execute function public.assert_director_score_authority();

drop trigger if exists director_scene_score_cues_authority_guard on public.director_scene_score_cues;
create trigger director_scene_score_cues_authority_guard
before insert or update on public.director_scene_score_cues
for each row execute function public.assert_director_score_authority();
