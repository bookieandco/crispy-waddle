create table if not exists public.jhadina_opportunities (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  opportunity_class text not null,
  strategy text not null,
  source_type text not null,
  source_name text not null,
  source_url text,
  source_external_id text,
  buyer jsonb,
  problem text,
  evidence jsonb not null default '[]'::jsonb,
  economics jsonb not null default '{}'::jsonb,
  score jsonb,
  match jsonb,
  outcome jsonb,
  status text not null,
  deadline timestamptz,
  requires_approval boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint jhadina_opportunities_evidence_array check (jsonb_typeof(evidence) = 'array'),
  constraint jhadina_opportunities_economics_object check (jsonb_typeof(economics) = 'object'),
  constraint jhadina_opportunities_score_object check (score is null or jsonb_typeof(score) = 'object'),
  constraint jhadina_opportunities_match_object check (match is null or jsonb_typeof(match) = 'object'),
  constraint jhadina_opportunities_outcome_object check (outcome is null or jsonb_typeof(outcome) = 'object')
);

create index if not exists jhadina_opportunities_user_status_idx
  on public.jhadina_opportunities (user_id, status, updated_at desc);

create index if not exists jhadina_opportunities_user_source_idx
  on public.jhadina_opportunities (user_id, source_type, updated_at desc);

create index if not exists jhadina_opportunities_deadline_idx
  on public.jhadina_opportunities (user_id, deadline)
  where deadline is not null;

alter table public.jhadina_opportunities enable row level security;

create policy "opportunities_select_own"
  on public.jhadina_opportunities
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "opportunities_insert_own"
  on public.jhadina_opportunities
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "opportunities_update_own"
  on public.jhadina_opportunities
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "opportunities_delete_own"
  on public.jhadina_opportunities
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
