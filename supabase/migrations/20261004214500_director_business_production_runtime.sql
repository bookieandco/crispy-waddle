-- Business Factory -> Director production commissioning state.
-- Creative execution may use already-configured local/free providers; this migration grants no publish or paid-media authority.

alter table public.director_project_business_context
  add column if not exists production_run_id text,
  add column if not exists video_job_id text,
  add column if not exists automation_status text not null default 'planned',
  add column if not exists automation_error text,
  add column if not exists commissioned_at timestamptz;

alter table public.director_project_business_context
  drop constraint if exists director_project_business_context_automation_status_check;
alter table public.director_project_business_context
  add constraint director_project_business_context_automation_status_check
  check (automation_status in (
    'planned','queued','running','shot_orchestration_ready','review','completed','blocked','failed'
  ));

alter table public.director_video_jobs
  drop constraint if exists director_video_jobs_source_check;
alter table public.director_video_jobs
  add constraint director_video_jobs_source_check
  check (source in ('ask-jhadina','business-factory','workstation'));

comment on column public.director_project_business_context.automation_status is
'Creative production progress only. Never implies publication, ad-spend, or financial authority.';
