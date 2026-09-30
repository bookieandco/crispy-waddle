-- MUSIC-RESTORE.6 post-deploy FK index hardening.
create index if not exists music_restoration_vocal_approver_idx
  on public.music_restoration_vocal_receipts(approved_by_user_id);
