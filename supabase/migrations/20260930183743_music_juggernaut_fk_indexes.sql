-- MUSIC-JUGGERNAUT.FINAL live index hardening.
-- Covers every project/song/experiment foreign key reported by the Supabase
-- performance advisor after production migration commissioning.

create index if not exists jhadina_music_song_campaigns_project_fk_idx
  on public.jhadina_music_song_campaigns(project_id);
create index if not exists jhadina_music_experiments_project_fk_idx
  on public.jhadina_music_experiments(project_id);
create index if not exists jhadina_music_experiments_song_fk_idx
  on public.jhadina_music_experiments(song_id);
create index if not exists jhadina_music_observations_project_fk_idx
  on public.jhadina_music_observations(project_id);
create index if not exists jhadina_music_observations_experiment_fk_idx
  on public.jhadina_music_observations(experiment_id);
create index if not exists jhadina_music_city_demand_project_fk_idx
  on public.jhadina_music_city_demand(project_id);
create index if not exists jhadina_music_rights_project_fk_idx
  on public.jhadina_music_rights(project_id);
create index if not exists jhadina_music_learning_project_fk_idx
  on public.jhadina_music_learning(project_id);
