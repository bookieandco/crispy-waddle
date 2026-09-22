-- Director reference-runtime post-admission hardening.
-- Make service-only RLS intent explicit and cover foreign-key lookup paths.

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'director_cast_characters',
    'director_character_appearance_variants',
    'director_voice_identities',
    'director_voice_reference_samples',
    'director_voice_provider_bindings',
    'director_voice_language_variants',
    'director_scene_character_bindings',
    'director_score_themes',
    'director_scene_score_cues'
  ]
  loop
    execute format('drop policy if exists %I_service_role_only on public.%I', table_name, table_name);
    execute format(
      'create policy %I_service_role_only on public.%I as restrictive for all to service_role using (true) with check (true)',
      table_name,
      table_name
    );
  end loop;
end $$;

create index if not exists director_cast_approved_by_idx
  on public.director_cast_characters(approved_by);
create index if not exists director_appearance_approved_by_idx
  on public.director_character_appearance_variants(approved_by);
create index if not exists director_bootstrap_user_idx
  on public.director_character_bootstrap_jobs(user_id);
create index if not exists director_reference_media_user_idx
  on public.director_reference_media_assets(user_id);

create index if not exists director_scene_binding_appearance_idx
  on public.director_scene_character_bindings(appearance_variant_id);
create index if not exists director_scene_binding_approved_by_idx
  on public.director_scene_character_bindings(approved_by);
create index if not exists director_scene_binding_character_fk_idx
  on public.director_scene_character_bindings(project_id, character_id);
create index if not exists director_scene_binding_voice_identity_idx
  on public.director_scene_character_bindings(voice_identity_id)
  where voice_identity_id is not null;
create index if not exists director_scene_binding_voice_variant_idx
  on public.director_scene_character_bindings(voice_variant_id)
  where voice_variant_id is not null;

create index if not exists director_score_cue_theme_idx
  on public.director_scene_score_cues(theme_id)
  where theme_id is not null;

create index if not exists director_voice_identity_approved_by_idx
  on public.director_voice_identities(approved_by);
create index if not exists director_voice_provider_identity_idx
  on public.director_voice_provider_bindings(voice_identity_id);
create index if not exists director_voice_reference_identity_idx
  on public.director_voice_reference_samples(voice_identity_id);
