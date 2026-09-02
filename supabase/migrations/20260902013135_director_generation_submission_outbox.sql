create table if not exists public.director_generation_submission_outbox (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  execution_id text not null,
  provider_id text not null,
  idempotency_key text not null,
  request_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','submitting','submitted','recovery_required','failed')),
  provider_job_id text,
  attempt integer not null default 0,
  lease_owner text,
  lease_token text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (provider_id, idempotency_key)
);

create index if not exists director_generation_submission_outbox_task_idx
  on public.director_generation_submission_outbox (task_id, created_at desc);

create index if not exists director_generation_submission_outbox_recovery_idx
  on public.director_generation_submission_outbox (status, lease_expires_at);

alter table public.director_generation_submission_outbox enable row level security;
revoke all on public.director_generation_submission_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.director_generation_submission_outbox to service_role;

comment on table public.director_generation_submission_outbox is 'Durable submission intent for Director generation providers; service-role only.';
