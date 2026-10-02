-- MUSIC-AUTO production hardening after live advisor pass.

create index if not exists jhadina_music_autopilot_charters_project_idx
  on public.jhadina_music_autopilot_charters(project_id);

create index if not exists jhadina_music_autopilot_runs_project_status_idx
  on public.jhadina_music_autopilot_runs(project_id,status,updated_at desc);

create index if not exists jhadina_music_autopilot_actions_project_status_idx
  on public.jhadina_music_autopilot_actions(project_id,status,updated_at desc);

create index if not exists jhadina_music_perception_bindings_project_idx
  on public.jhadina_music_perception_bindings(project_id);

create index if not exists jhadina_music_perception_bindings_song_idx
  on public.jhadina_music_perception_bindings(song_id);

create index if not exists jhadina_music_social_lineage_project_idx
  on public.jhadina_music_social_lineage(project_id);

create index if not exists jhadina_music_social_lineage_proposal_idx
  on public.jhadina_music_social_lineage(proposal_id);

create index if not exists jhadina_music_social_lineage_song_idx
  on public.jhadina_music_social_lineage(song_id);

drop policy if exists jhadina_music_autopilot_charters_owner_select on public.jhadina_music_autopilot_charters;
create policy jhadina_music_autopilot_charters_owner_select
  on public.jhadina_music_autopilot_charters for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists jhadina_music_autopilot_runs_owner_select on public.jhadina_music_autopilot_runs;
create policy jhadina_music_autopilot_runs_owner_select
  on public.jhadina_music_autopilot_runs for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists jhadina_music_autopilot_actions_owner_select on public.jhadina_music_autopilot_actions;
create policy jhadina_music_autopilot_actions_owner_select
  on public.jhadina_music_autopilot_actions for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists jhadina_music_social_lineage_owner_select on public.jhadina_music_social_lineage;
create policy jhadina_music_social_lineage_owner_select
  on public.jhadina_music_social_lineage for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists jhadina_music_perception_bindings_owner_select on public.jhadina_music_perception_bindings;
create policy jhadina_music_perception_bindings_owner_select
  on public.jhadina_music_perception_bindings for select
  to authenticated
  using (user_id = (select auth.uid()));
