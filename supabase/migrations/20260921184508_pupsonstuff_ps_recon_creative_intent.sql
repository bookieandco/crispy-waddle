-- PS-RECON migration replay receipt.
--
-- This version was applied through the connected Supabase migration API while
-- reconciling the live PupsonStuff project. The statements are additive /
-- idempotent. Keeping the exact applied version in source prevents remote/local
-- migration-ledger drift and adds the creative-attempt uniqueness invariant.

alter table public.pupson_creative_jobs
  add column if not exists user_prompt text,
  add column if not exists background_mode text not null default 'auto';

alter table public.pupson_creative_jobs
  drop constraint if exists pupson_creative_jobs_user_prompt_check;
alter table public.pupson_creative_jobs
  add constraint pupson_creative_jobs_user_prompt_check
  check (user_prompt is null or char_length(user_prompt) <= 2000);

alter table public.pupson_creative_jobs
  drop constraint if exists pupson_creative_jobs_background_mode_check;
alter table public.pupson_creative_jobs
  add constraint pupson_creative_jobs_background_mode_check
  check (background_mode in ('auto','transparent','keep','generate'));

create unique index if not exists pupson_creative_job_attempts_job_attempt_uidx
  on public.pupson_creative_job_attempts(job_id, attempt);

comment on column public.pupson_creative_jobs.user_prompt is
  'Bounded shopper-authored creative direction. Never treated as policy or provider authority.';
comment on column public.pupson_creative_jobs.background_mode is
  'Provider-neutral preprocessing intent: auto/transparent remove subject background, keep preserves it, generate lets the image generator author a new background.';
