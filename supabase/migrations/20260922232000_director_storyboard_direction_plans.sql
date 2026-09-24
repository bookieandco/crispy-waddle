-- Persist structured Director camera, performance, and realism plans.
--
-- This extends both canonical storyboard heads and append-only board history so
-- downstream generation/QC can reconstruct the exact authored direction used
-- for a board version. Existing RLS/grants remain unchanged.

alter table if exists public.director_storyboard_boards
  add column if not exists camera_plan jsonb,
  add column if not exists performance_plan jsonb,
  add column if not exists realism_plan jsonb,
  add column if not exists animation_plan jsonb;

alter table if exists public.director_storyboard_board_versions
  add column if not exists camera_plan jsonb,
  add column if not exists performance_plan jsonb,
  add column if not exists realism_plan jsonb;

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
    camera_plan, performance_plan, realism_plan, animation_plan,
    artifact_ids, created_at
  ) values (
    new.id, new.version, new.sequence_id, new.project_id, new.shot_id, new.ordinal, new.status,
    new.title, new.description, new.script_ref, new.reference_asset_ids, new.continuity_anchor_ids,
    new.continuity_locks, new.camera_language, new.framing, new.action, new.notes, new.cinematography,
    new.camera_plan, new.performance_plan, new.realism_plan, new.animation_plan,
    new.artifact_ids, new.updated_at
  );
  return new;
end;
$$;

comment on column public.director_storyboard_boards.camera_plan is
  'Structured DirectorCameraPlan for this canonical board version.';
comment on column public.director_storyboard_boards.performance_plan is
  'Structured PerformanceDirectionPlan for this canonical board version.';
comment on column public.director_storyboard_boards.realism_plan is
  'Structured RealismDirectionPlan for this canonical board version.';
comment on column public.director_storyboard_boards.animation_plan is
  'Structured AnimationPrinciplesPlan for this canonical board version.';

comment on column public.director_storyboard_board_versions.camera_plan is
  'Append-only structured DirectorCameraPlan evidence.';
comment on column public.director_storyboard_board_versions.performance_plan is
  'Append-only structured PerformanceDirectionPlan evidence.';
comment on column public.director_storyboard_board_versions.realism_plan is
  'Append-only structured RealismDirectionPlan evidence.';
comment on column public.director_storyboard_board_versions.animation_plan is
  'Append-only structured AnimationPrinciplesPlan evidence.';
