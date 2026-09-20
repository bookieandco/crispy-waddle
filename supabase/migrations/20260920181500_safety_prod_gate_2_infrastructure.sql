insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('jhadina-safety-evidence','jhadina-safety-evidence',false,52428800,array['application/octet-stream'])
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname='jhadina-safety-deadman-watchdog';

select cron.schedule(
  'jhadina-safety-deadman-watchdog',
  '* * * * *',
  $$select public.claim_due_jhadina_safety_incidents(now(),120,50);$$
);
