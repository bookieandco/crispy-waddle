-- Admit the explicit Homebase capture alias source kind into durable Watch jobs.
-- This does not broaden cloud Watch: cloud routes still reject private/local sources,
-- and the Homebase worker resolves aliases through its own allowlisted configuration.

alter table public.director_watch_jobs
  drop constraint if exists director_watch_jobs_source_kind_check;

alter table public.director_watch_jobs
  add constraint director_watch_jobs_source_kind_check
  check (source_kind in (
    'local-file',
    'hls',
    'dash',
    'rtsp',
    'capture',
    'homebase-capture',
    'authorized-stream'
  ));

comment on column public.director_watch_jobs.source_kind is
'Source transport only. homebase-capture is an owner-configured alias resolved by the Homebase worker; cloud Watch remains HTTPS-only.';
