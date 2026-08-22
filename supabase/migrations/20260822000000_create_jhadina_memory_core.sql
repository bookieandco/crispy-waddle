-- Jhadina Memory Core (Phase 1, Step 2).
--
-- Backs apps/jhadina-web's MemoryRepository / ReasoningEventRepository /
-- TimelineRepository, which previously wrote only to an in-memory Map that
-- was explicitly documented as "lost on application restart." This
-- migration gives them a durable backend on the same project the rest of
-- Jhadina's schema already lives on, with no change to the approval
-- governance those repositories already enforce: a candidate is created
-- PENDING, and only an explicit approve/reject call turns it into a
-- durable memory or discards it. Nothing in this schema — or in the
-- application code wired to it — lets an observation silently become a
-- permanent memory.
--
-- Access model: this app has no real end-user Supabase Auth session yet
-- (userId today is a raw header value / "user_demo" placeholder — see
-- apps/jhadina-web/src/lib/routes/handlers.ts). Writing RLS against
-- auth.uid() here would look like user-level enforcement while actually
-- enforcing nothing, since auth.uid() is null for every one of these
-- requests. Until real identity exists, these tables are locked to
-- service_role only, with user_id scoping enforced in the repository
-- layer exactly as it already is today. Revisit once Identity/Ask Jhadina
-- auth is real.

create table if not exists public.jhadina_memory_candidates (
  id text primary key,
  user_id text not null,
  type text not null check (type in ('PREFERENCE', 'IDENTITY', 'GOAL', 'CONTEXT')),
  status text not null default 'PENDING' check (status = 'PENDING'),
  content text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  reasoning_event_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_memory_candidates_user_idx
  on public.jhadina_memory_candidates (user_id, created_at desc);

create table if not exists public.jhadina_memories (
  id text primary key,
  user_id text not null,
  type text not null check (type in ('PREFERENCE', 'IDENTITY', 'GOAL', 'CONTEXT')),
  status text not null check (status in ('APPROVED', 'REJECTED')),
  content text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null,
  approved_at timestamptz,
  rejected_at timestamptz
);

create index if not exists jhadina_memories_user_status_idx
  on public.jhadina_memories (user_id, status);

create table if not exists public.jhadina_reasoning_events (
  id text primary key,
  user_id text not null,
  occurred_at timestamptz not null,
  user_message text not null,
  observation jsonb not null default '{}'::jsonb,
  classification jsonb not null default '{}'::jsonb,
  system_response text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  candidate_id text,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_reasoning_events_user_idx
  on public.jhadina_reasoning_events (user_id, occurred_at desc);

create table if not exists public.jhadina_timeline_events (
  id text primary key,
  user_id text not null,
  occurred_at timestamptz not null,
  type text not null check (type in ('REASONING', 'APPROVAL', 'REJECTION')),
  reasoning_event_id text,
  memory_id text,
  memory_type text check (memory_type in ('PREFERENCE', 'IDENTITY', 'GOAL', 'CONTEXT')),
  memory_content text,
  decision text check (decision in ('APPROVED', 'REJECTED')),
  created_at timestamptz not null default now()
);

create index if not exists jhadina_timeline_events_user_idx
  on public.jhadina_timeline_events (user_id, occurred_at desc);

alter table public.jhadina_memory_candidates enable row level security;
alter table public.jhadina_memories enable row level security;
alter table public.jhadina_reasoning_events enable row level security;
alter table public.jhadina_timeline_events enable row level security;

create policy jhadina_memory_candidates_service_role_only
  on public.jhadina_memory_candidates as restrictive for all
  to service_role using (true) with check (true);

create policy jhadina_memories_service_role_only
  on public.jhadina_memories as restrictive for all
  to service_role using (true) with check (true);

create policy jhadina_reasoning_events_service_role_only
  on public.jhadina_reasoning_events as restrictive for all
  to service_role using (true) with check (true);

create policy jhadina_timeline_events_service_role_only
  on public.jhadina_timeline_events as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_memory_candidates from anon, authenticated;
revoke all on public.jhadina_memories from anon, authenticated;
revoke all on public.jhadina_reasoning_events from anon, authenticated;
revoke all on public.jhadina_timeline_events from anon, authenticated;
