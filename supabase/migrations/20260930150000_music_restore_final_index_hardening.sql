-- MUSIC-RESTORE.FINAL post-deploy FK index hardening.

create index if not exists music_restoration_final_source_idx
  on public.music_restoration_final_certifications(source_artifact_id);

create index if not exists music_restoration_final_current_version_idx
  on public.music_restoration_final_certifications(current_version_id);
