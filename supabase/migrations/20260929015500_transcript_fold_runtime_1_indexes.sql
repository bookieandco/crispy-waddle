-- TRANSCRIPT-FOLD.RUNTIME.1 index closure for Social canary receipt foreign keys.

create index if not exists jhadina_social_platform_receipts_outbox_idx
  on public.jhadina_social_platform_receipts (outbox_id);

create index if not exists jhadina_social_platform_receipts_account_idx
  on public.jhadina_social_platform_receipts (account_id);
