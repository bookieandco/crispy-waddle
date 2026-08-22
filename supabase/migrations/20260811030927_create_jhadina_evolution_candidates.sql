create table if not exists public.jhadina_evolution_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null unique,
  audit_run_id text not null,
  category text not null check (category in ('CI','DEPENDENCY','SECURITY','ISSUE','PR','REPOSITORY')),
  title text not null,
  problem text not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  affected_paths jsonb not null default '[]'::jsonb,
  risk text not null check (risk in ('LOW','MEDIUM','HIGH','CRITICAL')),
  impact integer not null check (impact between 0 and 100),
  confidence integer not null check (confidence between 0 and 100),
  recurrence integer not null check (recurrence between 0 and 100),
  change_size integer not null check (change_size between 0 and 100),
  priority integer not null,
  suggested_change text not null,
  verification_plan jsonb not null default '[]'::jsonb,
  discovered_at timestamptz not null,
  proposal_hash text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','DEFERRED','EXECUTING','VERIFIED','FAILED','ROLLED_BACK')),
  decision_reason text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  execution_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_evolution_candidates_audit_run_idx on public.jhadina_evolution_candidates (audit_run_id);
create index if not exists jhadina_evolution_candidates_status_priority_idx on public.jhadina_evolution_candidates (status, priority desc, discovered_at desc);
create index if not exists jhadina_evolution_candidates_decided_by_idx on public.jhadina_evolution_candidates (decided_by);

alter table public.jhadina_evolution_candidates enable row level security;

create policy "authenticated users can read evolution candidates"
  on public.jhadina_evolution_candidates for select
  to authenticated
  using (true);

create policy "authenticated users can decide evolution candidates"
  on public.jhadina_evolution_candidates for update
  to authenticated
  using (true)
  with check (status in ('PENDING','APPROVED','REJECTED','DEFERRED','EXECUTING','VERIFIED','FAILED','ROLLED_BACK'));

revoke insert, delete on public.jhadina_evolution_candidates from anon, authenticated;

create or replace function public.jhadina_evolution_candidate_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jhadina_evolution_candidates_touch_updated_at on public.jhadina_evolution_candidates;
create trigger jhadina_evolution_candidates_touch_updated_at
before update on public.jhadina_evolution_candidates
for each row execute function public.jhadina_evolution_candidate_touch_updated_at();
