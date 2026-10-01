-- Cover MUSIC-COMMISSION foreign keys with leading-column indexes for FK lookups/cascade maintenance.

create index if not exists jhadina_music_artist_profiles_project_fk_idx
  on public.jhadina_music_artist_profiles(project_id);
create index if not exists jhadina_music_platform_accounts_project_fk_idx
  on public.jhadina_music_platform_accounts(project_id);
create index if not exists jhadina_music_catalog_releases_project_fk_idx
  on public.jhadina_music_catalog_releases(project_id);
create index if not exists jhadina_music_commission_receipts_project_fk_idx
  on public.jhadina_music_commission_receipts(project_id);
create index if not exists jhadina_music_royalty_snapshots_project_fk_idx
  on public.jhadina_music_royalty_snapshots(project_id);
create index if not exists jhadina_music_royalty_lines_project_fk_idx
  on public.jhadina_music_royalty_lines(project_id);
create index if not exists jhadina_music_royalty_lines_snapshot_fk_idx
  on public.jhadina_music_royalty_lines(snapshot_id);
