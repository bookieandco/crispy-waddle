-- Durable Director cast bible, scene appearance bindings, and character voice identities.
create table if not exists public.director_cast_records (
  id text primary key,
  project_id text not null,
  character_id text not null,
  continuity_ref text not null,
  canonical_appearance_variant_id text not null,
  cast_record jsonb not null,
  approved_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, character_id)
);

create index if not exists director_cast_records_project_idx
  on public.director_cast_records(project_id, character_id);

create table if not exists public.director_character_scene_bindings (
  project_id text not null,
  scene_id text not null,
  character_id text not null,
  binding jsonb not null,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(project_id, scene_id, character_id),
  foreign key(project_id, character_id)
    references public.director_cast_records(project_id, character_id)
    on delete cascade
);

create table if not exists public.director_voice_identities (
  id text primary key,
  project_id text not null,
  character_id text not null,
  voice_identity jsonb not null,
  approved_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(project_id, character_id)
    references public.director_cast_records(project_id, character_id)
    on delete cascade
);

create index if not exists director_voice_identities_character_idx
  on public.director_voice_identities(project_id, character_id);

alter table public.director_cast_records enable row level security;
alter table public.director_character_scene_bindings enable row level security;
alter table public.director_voice_identities enable row level security;

revoke all on public.director_cast_records from public, anon, authenticated;
revoke all on public.director_character_scene_bindings from public, anon, authenticated;
revoke all on public.director_voice_identities from public, anon, authenticated;
grant select, insert, update, delete on public.director_cast_records to service_role;
grant select, insert, update, delete on public.director_character_scene_bindings to service_role;
grant select, insert, update, delete on public.director_voice_identities to service_role;

drop policy if exists director_cast_records_service_role_only on public.director_cast_records;
create policy director_cast_records_service_role_only
  on public.director_cast_records as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_character_scene_bindings_service_role_only on public.director_character_scene_bindings;
create policy director_character_scene_bindings_service_role_only
  on public.director_character_scene_bindings as restrictive for all to service_role
  using (true) with check (true);

drop policy if exists director_voice_identities_service_role_only on public.director_voice_identities;
create policy director_voice_identities_service_role_only
  on public.director_voice_identities as restrictive for all to service_role
  using (true) with check (true);

create or replace function public.assert_director_cast_authority()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  actor uuid;
  role_value text;
begin
  actor := case
    when tg_table_name='director_cast_records' then new.approved_by_user_id
    when tg_table_name='director_character_scene_bindings' then new.updated_by_user_id
    when tg_table_name='director_voice_identities' then new.approved_by_user_id
    else null
  end;

  if actor is null then raise exception 'Director cast actor required'; end if;

  select role into role_value
  from public.director_project_memberships
  where project_id=new.project_id and user_id=actor;

  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director cast mutation requires project edit authority';
  end if;

  if tg_op='UPDATE' then
    if old.project_id<>new.project_id then raise exception 'Director cast project identity is immutable'; end if;
    if tg_table_name='director_cast_records' and old.character_id<>new.character_id then
      raise exception 'Director character identity is immutable';
    end if;
    if tg_table_name='director_voice_identities' and old.character_id<>new.character_id then
      raise exception 'Director voice character identity is immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists director_cast_records_authority_guard on public.director_cast_records;
create trigger director_cast_records_authority_guard
before insert or update on public.director_cast_records
for each row execute function public.assert_director_cast_authority();

drop trigger if exists director_character_scene_bindings_authority_guard on public.director_character_scene_bindings;
create trigger director_character_scene_bindings_authority_guard
before insert or update on public.director_character_scene_bindings
for each row execute function public.assert_director_cast_authority();

drop trigger if exists director_voice_identities_authority_guard on public.director_voice_identities;
create trigger director_voice_identities_authority_guard
before insert or update on public.director_voice_identities
for each row execute function public.assert_director_cast_authority();
