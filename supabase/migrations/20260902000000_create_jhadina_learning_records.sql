-- Canonical durable LearningRecord / OutcomeRecord store.
--
-- Learning records are facts, not mutable learned state. The Bayesian/source
-- performance models must project from this history rather than overwrite it.
-- This table is intentionally server-side only: anon/authenticated receive no
-- table privileges, and the application adapter uses the existing privileged
-- service-role client. RLS is enabled as defense in depth.
--
-- Append-only is enforced independently of RLS because service_role bypasses
-- RLS. UPDATE/DELETE are rejected by a database trigger, so even privileged
-- application code cannot mutate historical learning facts.

create table if not exists public.jhadina_learning_records (
  id text primary key,
  schema_version text not null,
  occurred_at timestamptz not null,
  domain text not null,
  experience_id text,
  proposal_id text not null,
  policy_decision_id text,
  action_request_id text,
  action_result_id text,
  correlation_id text not null,
  source text not null,
  actor text not null check (actor in ('user', 'jhadina', 'system', 'external')),
  evidence jsonb not null default '[]'::jsonb,
  prediction jsonb,
  outcome jsonb not null,
  learning_update jsonb not null,
  provenance jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_learning_records_domain_idx
  on public.jhadina_learning_records (domain, occurred_at desc);

create index if not exists jhadina_learning_records_correlation_idx
  on public.jhadina_learning_records (correlation_id, occurred_at desc);

create index if not exists jhadina_learning_records_proposal_idx
  on public.jhadina_learning_records (proposal_id, occurred_at desc);

alter table public.jhadina_learning_records enable row level security;

create policy jhadina_learning_records_service_role_only
  on public.jhadina_learning_records as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.jhadina_learning_records from public, anon, authenticated, service_role;
grant select, insert on public.jhadina_learning_records to service_role;

create or replace function public.prevent_jhadina_learning_record_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'jhadina_learning_records_are_append_only';
end;
$$;

create trigger jhadina_learning_records_append_only
before update or delete on public.jhadina_learning_records
for each row execute function public.prevent_jhadina_learning_record_mutation();
