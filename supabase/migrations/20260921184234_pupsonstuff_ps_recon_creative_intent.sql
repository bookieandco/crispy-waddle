-- PS-RECON creative intent durability.
-- Additive only: existing creative jobs default to background removal mode
-- "auto"; shopper prompts remain nullable. Browser roles remain revoked by
-- the PS-CLOSE service-role-only table policy.

alter table public.pupson_creative_jobs
  add column if not exists user_prompt text,
  add column if not exists background_mode text not null default 'auto';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pupson_creative_jobs'::regclass
      and conname = 'pupson_creative_jobs_user_prompt_length_check'
  ) then
    alter table public.pupson_creative_jobs
      add constraint pupson_creative_jobs_user_prompt_length_check
      check (user_prompt is null or char_length(user_prompt) <= 2000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pupson_creative_jobs'::regclass
      and conname = 'pupson_creative_jobs_background_mode_check'
  ) then
    alter table public.pupson_creative_jobs
      add constraint pupson_creative_jobs_background_mode_check
      check (background_mode in ('auto','transparent','keep','generate'));
  end if;
end $$;
