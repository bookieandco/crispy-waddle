create table if not exists public.jhadina_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  type text not null check (type in ('PREFERENCE','IDENTITY','GOAL','CONTEXT')),
  status text not null default 'APPROVED' check (status in ('PENDING','APPROVED','REJECTED')),
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  evidence jsonb not null default '[]'::jsonb,
  source text not null default 'user_message',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz
);

create table if not exists public.jhadina_memory_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  type text not null check (type in ('PREFERENCE','IDENTITY','GOAL','CONTEXT')),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  evidence jsonb not null default '[]'::jsonb,
  reasoning_event_id uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_memory_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.jhadina_memory_candidates(id) on delete restrict,
  decision text not null check (decision in ('APPROVED','REJECTED')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.jhadina_reasoning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_message text not null,
  observation jsonb not null default '{}'::jsonb,
  classification jsonb not null default '{}'::jsonb,
  system_response text,
  confidence double precision check (confidence >= 0 and confidence <= 1),
  candidate_id uuid references public.jhadina_memory_candidates(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.jhadina_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('REASONING','APPROVAL','REJECTION')),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  related_memory_id uuid references public.jhadina_memories(id) on delete set null,
  related_candidate_id uuid references public.jhadina_memory_candidates(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_memories_user_status_idx
  on public.jhadina_memories(user_id, status);
create index if not exists jhadina_memories_user_created_idx
  on public.jhadina_memories(user_id, created_at desc);
create index if not exists jhadina_memories_user_type_idx
  on public.jhadina_memories(user_id, type);
create index if not exists jhadina_memory_candidates_user_status_idx
  on public.jhadina_memory_candidates(user_id, status);
create index if not exists jhadina_memory_candidates_user_created_idx
  on public.jhadina_memory_candidates(user_id, created_at desc);
create index if not exists jhadina_memory_approvals_user_created_idx
  on public.jhadina_memory_approvals(user_id, created_at desc);
create index if not exists jhadina_memory_approvals_candidate_idx
  on public.jhadina_memory_approvals(candidate_id);
create index if not exists jhadina_reasoning_events_user_created_idx
  on public.jhadina_reasoning_events(user_id, created_at desc);
create index if not exists jhadina_timeline_events_user_created_idx
  on public.jhadina_timeline_events(user_id, created_at desc);
create index if not exists jhadina_timeline_events_user_type_idx
  on public.jhadina_timeline_events(user_id, event_type);

alter table public.jhadina_memories enable row level security;
alter table public.jhadina_memory_candidates enable row level security;
alter table public.jhadina_memory_approvals enable row level security;
alter table public.jhadina_reasoning_events enable row level security;
alter table public.jhadina_timeline_events enable row level security;

create policy "jhadina_memories_owner_access" on public.jhadina_memories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "jhadina_memory_candidates_owner_access" on public.jhadina_memory_candidates
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "jhadina_memory_approvals_owner_access" on public.jhadina_memory_approvals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "jhadina_reasoning_events_owner_access" on public.jhadina_reasoning_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "jhadina_timeline_events_owner_access" on public.jhadina_timeline_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
