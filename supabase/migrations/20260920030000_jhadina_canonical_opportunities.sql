create table if not exists public.jhadina_opportunities (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  family text not null,
  opportunity_type text not null,
  status text not null,
  source_name text not null,
  source_url text not null,
  deadline timestamptz,
  fit_score double precision,
  triage_state text not null default 'review' check (triage_state in ('review','saved','dismissed')),
  approved_at timestamptz,
  research_case_id text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

create index if not exists jhadina_opportunities_user_status_idx
  on public.jhadina_opportunities (user_id, status, updated_at desc);

create index if not exists jhadina_opportunities_user_family_idx
  on public.jhadina_opportunities (user_id, family, updated_at desc);

create index if not exists jhadina_opportunities_user_triage_idx
  on public.jhadina_opportunities (user_id, triage_state, fit_score desc);

alter table public.jhadina_opportunities enable row level security;

create policy "jhadina_opportunities_select_own"
  on public.jhadina_opportunities for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "jhadina_opportunities_insert_own"
  on public.jhadina_opportunities for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "jhadina_opportunities_update_own"
  on public.jhadina_opportunities for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "jhadina_opportunities_delete_own"
  on public.jhadina_opportunities for delete to authenticated
  using ((select auth.uid()) = user_id);
