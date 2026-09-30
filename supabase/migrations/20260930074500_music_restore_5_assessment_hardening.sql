-- MUSIC-RESTORE.5 donor assessment provenance hardening.
-- The baseline reconstruction migration is already applied in production,
-- so assessment fields are added in a new forward-only migration.

alter table public.music_restoration_reconstruction_receipts
  add column if not exists assessment_runtime_receipt_id text;

alter table public.music_restoration_reconstruction_receipts
  add column if not exists assessment jsonb;

-- No reconstruction receipts existed when this hardening was introduced.
-- Fail closed if a future environment somehow contains legacy null rows.
do $$
begin
  if exists (
    select 1
    from public.music_restoration_reconstruction_receipts
    where assessment_runtime_receipt_id is null
       or assessment is null
  ) then
    raise exception 'MUSIC_RESTORE_5_ASSESSMENT_BACKFILL_REQUIRED';
  end if;
end
$$;

alter table public.music_restoration_reconstruction_receipts
  alter column assessment_runtime_receipt_id set not null;

alter table public.music_restoration_reconstruction_receipts
  alter column assessment set not null;

create index if not exists music_restoration_reconstruction_assessment_receipt_idx
  on public.music_restoration_reconstruction_receipts(assessment_runtime_receipt_id);
