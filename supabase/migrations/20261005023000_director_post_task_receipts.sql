-- Domain receipts for Director ONE-RUNTIME post-production tasks.
-- Compute execution proves a task ran; this table records what Director-specific evidence the task produced.

create table if not exists public.director_post_task_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  work_session_id text not null,
  task_id text not null,
  capability text not null,
  status text not null check (status in ('succeeded','failed')),
  output_refs text[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb,
  error_code text,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(owner_user_id,work_session_id,task_id)
);

create index if not exists director_post_task_receipts_project_idx
  on public.director_post_task_receipts(project_id,completed_at desc);

alter table public.director_post_task_receipts enable row level security;
revoke all on public.director_post_task_receipts from public,anon,authenticated;
grant select,insert,update on public.director_post_task_receipts to service_role;

drop policy if exists director_post_task_receipts_service_role_only
  on public.director_post_task_receipts;
create policy director_post_task_receipts_service_role_only
  on public.director_post_task_receipts
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_post_task_receipts is
'Capability-scoped Director post-production result receipts. A receipt is evidence input only; it grants no approval or publication authority.';
