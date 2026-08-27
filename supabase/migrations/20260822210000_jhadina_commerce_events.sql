-- Jhadina Commerce Step 8: durable Event Bus storage.
--
-- Records what already happened in the governed proposal lifecycle
-- (proposal_created, approval_granted, execution_started,
-- execution_succeeded, execution_failed, replay_rejected). This table
-- grants nothing and is never consulted by policy — it is a
-- distribution/audit record, not an authorization boundary. The actual
-- authorization decision lives in SecurityCoreActionPolicy and the
-- approval-receipt RPCs (see 20260822190000/20260822200000).
--
-- The primary key is the caller-supplied deterministic event id
-- (commerce-event:{proposalId}:{type}), not a generated uuid, so a
-- retried or duplicate publish() for the same logical occurrence is a
-- true no-op at the database layer (on conflict do nothing) — not just
-- in the in-memory reference implementation.
create table if not exists public.jhadina_commerce_events (
  id text primary key,
  proposal_id text not null,
  capability text not null,
  type text not null check (type in (
    'proposal_created', 'approval_granted', 'execution_started',
    'execution_succeeded', 'execution_failed', 'replay_rejected'
  )),
  actor_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_commerce_events_proposal_idx
  on public.jhadina_commerce_events (proposal_id, occurred_at);

create index if not exists jhadina_commerce_events_actor_idx
  on public.jhadina_commerce_events (actor_id, occurred_at desc);

alter table public.jhadina_commerce_events enable row level security;

create policy "commerce events are owner readable"
  on public.jhadina_commerce_events
  for select
  using (auth.uid() = actor_id);

-- Idempotent by design: a second publish() for the same event id is a
-- silent no-op, never a duplicate row and never an error — exactly the
-- "duplicate events" behavior the Event Bus contract requires.
create or replace function public.jhadina_commerce_publish_event(
  p_id text,
  p_proposal_id text,
  p_capability text,
  p_type text,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.jhadina_commerce_events (
    id, proposal_id, capability, type, actor_id, occurred_at, payload
  )
  values (
    p_id, p_proposal_id, p_capability, p_type, auth.uid(), p_occurred_at, p_payload
  )
  on conflict (id) do nothing;
end;
$$;
