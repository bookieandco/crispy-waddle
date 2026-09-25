-- Persist canonical cinematography lighting plans on storyboard heads and append-only history.
-- Lighting follows the Director working order: Direction -> Quality -> Color -> Intensity -> Cut & Shape.

alter table if exists public.director_storyboard_boards
  add column if not exists lighting_plan jsonb;

alter table if exists public.director_storyboard_board_versions
  add column if not exists lighting_plan jsonb;

create or replace function public.capture_director_storyboard_board_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.director_storyboard_board_versions (
    board_id, version, sequence_id, project_id, shot_id, ordinal, status,
    title, description, script_ref, reference_asset_ids, continuity_anchor_ids,
    continuity_locks, camera_language, framing, action, notes, cinematography,
    camera_plan, performance_plan, realism_plan, lighting_plan, animation_plan,
    artifact_ids, created_at
  ) values (
    new.id, new.version, new.sequence_id, new.project_id, new.shot_id, new.ordinal, new.status,
    new.title, new.description, new.script_ref, new.reference_asset_ids, new.continuity_anchor_ids,
    new.continuity_locks, new.camera_language, new.framing, new.action, new.notes, new.cinematography,
    new.camera_plan, new.performance_plan, new.realism_plan, new.lighting_plan, new.animation_plan,
    new.artifact_ids, new.updated_at
  );
  return new;
end;
$$;

comment on column public.director_storyboard_boards.lighting_plan is
  'Structured CinematographyLightingPlan for this canonical board version.';

comment on column public.director_storyboard_board_versions.lighting_plan is
  'Append-only structured CinematographyLightingPlan evidence.';
