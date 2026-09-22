-- Director movie-scale cast, voice and score continuity.
-- Repo migration only: do not apply live until Director CI/schema review passes.

create table if not exists public.director_cast_characters (
  id text primary key,
  project_id text not null,
  character_id text not null,
  display_name text not null,
  archetype text not null check (archetype in ('human','cartoon','puppet','creature')),
  continuity_ref text not null,
  behavior_dna jsonb,
  rig_asset_id text,
  canonical_appearance_variant_id text not null,
  locked_traits text[] not null default '{}',
  approved_at timestamptz not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(project_id, character_id),
  unique(project_id, continuity_ref)
);

create table if not exists public.director_character_appearance_variants (
  id text primary key,
  project_id text not null,
  character_id text not null,
  kind text not null check (kind in ('base','wardrobe','age','damage','hair','makeup','environment','custom')),
  label text not null,
  reference_asset_ids text[] not null default '{}',
  reference_sha256s text[] not null default '{}',
  wardrobe_notes text[] not null default '{}',
  appearance_notes text[] not null default '{}',
  approved_at timestamptz not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(project_id, character_id)
    references public.director_cast_characters(project_id, character_id)
    on delete cascade
);

create table if not exists public.director_voice_identities (
  id text primary key,
  project_id text not null,
  character_id text not null,
  display_name text not null,
  source text not null check (source in ('owned-recording','consented-clone','designed','preset')),
  consent_ref text,
  primary_language text not null,
  default_variant_id text not null,
  approved_at timestamptz not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key(project_id, character_id)
    references public.director_cast_characters(project_id, character_id)
    on delete cascade,
  unique(project_id, character_id)
);

create table if not exists public.director_voice_reference_samples (
  id text primary key,
  voice_identity_id text not null references public.director_voice_identities(id) on delete cascade,
  asset_id text not null,
  sha256 text not null,
  language text not null,
  transcript text,
  duration_seconds numeric not null check(duration_seconds > 0),
  rights_ref text not null,
  quality_evidence_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.director_voice_provider_bindings (
  id text primary key,
  voice_identity_id text not null references public.director_voice_identities(id) on delete cascade,
  provider text not null,
  model_id text not null,
  provider_voice_ref text,
  reference_sample_ids text[] not null default '{}',
  supported_languages text[] not null default '{}',
  sample_rate_hz integer,
  provenance_refs text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.director_voice_language_variants (
  id text primary key,
  voice_identity_id text not null references public.director_voice_identities(id) on delete cascade,
  language text not null,
  locale text,
  pronunciation_lexicon_ref text,
  accent_policy text not null check(accent_policy in ('preserve-identity','native-target','directed')),
  delivery_style text,
  provider_binding_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(voice_identity_id, language, coalesce(locale,''))
);

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
  created_at timestamptz not null default now()
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
  evidence_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists director_cast_project_idx on public.director_cast_characters(project_id, character_id);
create index if not exists director_appearance_character_idx on public.director_character_appearance_variants(project_id, character_id);
create index if not exists director_voice_character_idx on public.director_voice_identities(project_id, character_id);
create index if not exists director_score_project_idx on public.director_score_themes(project_id);
create index if not exists director_score_cue_scene_idx on public.director_scene_score_cues(project_id, scene_id);

alter table public.director_cast_characters enable row level security;
alter table public.director_character_appearance_variants enable row level security;
alter table public.director_voice_identities enable row level security;
alter table public.director_voice_reference_samples enable row level security;
alter table public.director_voice_provider_bindings enable row level security;
alter table public.director_voice_language_variants enable row level security;
alter table public.director_score_themes enable row level security;
alter table public.director_scene_score_cues enable row level security;

revoke all on public.director_cast_characters from public,anon,authenticated;
revoke all on public.director_character_appearance_variants from public,anon,authenticated;
revoke all on public.director_voice_identities from public,anon,authenticated;
revoke all on public.director_voice_reference_samples from public,anon,authenticated;
revoke all on public.director_voice_provider_bindings from public,anon,authenticated;
revoke all on public.director_voice_language_variants from public,anon,authenticated;
revoke all on public.director_score_themes from public,anon,authenticated;
revoke all on public.director_scene_score_cues from public,anon,authenticated;

grant select,insert,update,delete on public.director_cast_characters to service_role;
grant select,insert,update,delete on public.director_character_appearance_variants to service_role;
grant select,insert,update,delete on public.director_voice_identities to service_role;
grant select,insert,update,delete on public.director_voice_reference_samples to service_role;
grant select,insert,update,delete on public.director_voice_provider_bindings to service_role;
grant select,insert,update,delete on public.director_voice_language_variants to service_role;
grant select,insert,update,delete on public.director_score_themes to service_role;
grant select,insert,update,delete on public.director_scene_score_cues to service_role;

create or replace function public.assert_director_cast_authority()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  uid uuid;
  pid text;
  role_value text;
begin
  uid := coalesce(new.approved_by, old.approved_by);
  pid := coalesce(new.project_id, old.project_id);
  select role into role_value
  from public.director_project_memberships
  where project_id=pid and user_id=uid;
  if role_value is null or role_value not in ('owner','editor') then
    raise exception 'Director cast edit authority required';
  end if;
  return new;
end;
$$;

drop trigger if exists director_cast_authority_guard on public.director_cast_characters;
create trigger director_cast_authority_guard
before insert or update on public.director_cast_characters
for each row execute function public.assert_director_cast_authority();

drop trigger if exists director_appearance_authority_guard on public.director_character_appearance_variants;
create trigger director_appearance_authority_guard
before insert or update on public.director_character_appearance_variants
for each row execute function public.assert_director_cast_authority();

drop trigger if exists director_voice_authority_guard on public.director_voice_identities;
create trigger director_voice_authority_guard
before insert or update on public.director_voice_identities
for each row execute function public.assert_director_cast_authority();
