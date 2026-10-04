-- Extend Director Watch as the independent VLM/QC worker for generated take evaluation.

alter table public.director_watch_jobs
  drop constraint if exists director_watch_jobs_purpose_check;
alter table public.director_watch_jobs
  add constraint director_watch_jobs_purpose_check
  check (purpose in ('creative','sports','take-qc'));

alter table public.director_watch_jobs
  add column if not exists project_id text,
  add column if not exists take_group_id text,
  add column if not exists take_id text,
  add column if not exists generation_task_id text,
  add column if not exists asset_id text references public.director_generated_editing_assets(id) on delete set null;

create index if not exists director_watch_jobs_take_qc_idx
  on public.director_watch_jobs(project_id,take_group_id,take_id,updated_at desc)
  where purpose='take-qc';

comment on column public.director_watch_jobs.asset_id is
'Optional generated asset under independent Watch/QC analysis; the worker receives only a short-lived signed source URL.';
