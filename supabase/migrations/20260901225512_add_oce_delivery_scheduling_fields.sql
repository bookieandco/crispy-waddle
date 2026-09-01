alter table public.oce_alert_deliveries
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_error text,
  add column if not exists max_attempts integer not null default 5,
  add column if not exists dead_lettered_at timestamptz;

create index if not exists oce_alert_deliveries_retry_idx
  on public.oce_alert_deliveries (status, next_attempt_at)
  where status in ('PENDING', 'RETRYING');
