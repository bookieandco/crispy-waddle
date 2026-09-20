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


-- OPP-AUDIT.5: durable, idempotent research/pursuit state.
create table if not exists public.jhadina_opportunity_research_cases (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  opportunity_id text not null,
  title text not null,
  status text not null check (status in ('pending','researching','blocked','ready','closed')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id),
  unique (user_id, opportunity_id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create table if not exists public.jhadina_opportunity_research_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  research_case_id text not null,
  kind text not null,
  title text not null,
  required boolean not null default true,
  status text not null check (status in ('pending','in_progress','completed','blocked')),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null,
  completed_at timestamptz,
  primary key (user_id, id),
  unique (user_id, research_case_id, kind),
  foreign key (user_id, research_case_id)
    references public.jhadina_opportunity_research_cases(user_id, id) on delete cascade
);

create table if not exists public.jhadina_opportunity_outbox (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  opportunity_id text not null,
  event_type text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  primary key (user_id, event_id),
  foreign key (user_id, opportunity_id)
    references public.jhadina_opportunities(user_id, id) on delete cascade
);

create index if not exists jhadina_opportunity_research_cases_status_idx
  on public.jhadina_opportunity_research_cases (user_id, status, updated_at desc);

create index if not exists jhadina_opportunity_research_tasks_case_idx
  on public.jhadina_opportunity_research_tasks (user_id, research_case_id, status);

create index if not exists jhadina_opportunity_outbox_pending_idx
  on public.jhadina_opportunity_outbox (created_at)
  where published_at is null;

alter table public.jhadina_opportunity_research_cases enable row level security;
alter table public.jhadina_opportunity_research_tasks enable row level security;
alter table public.jhadina_opportunity_outbox enable row level security;

create policy "jhadina_opportunity_research_cases_select_own"
  on public.jhadina_opportunity_research_cases for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "jhadina_opportunity_research_tasks_select_own"
  on public.jhadina_opportunity_research_tasks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "jhadina_opportunity_outbox_select_own"
  on public.jhadina_opportunity_outbox for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.jhadina_opportunity_start_research(
  p_opportunity_id text,
  p_opportunity jsonb,
  p_case jsonb,
  p_tasks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.jhadina_opportunities%rowtype;
  v_task jsonb;
  v_case_id text := p_case->>'id';
  v_now timestamptz := now();
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;
  if coalesce(p_opportunity->>'id','') <> p_opportunity_id then
    raise exception 'opportunity payload id mismatch';
  end if;
  if coalesce(p_opportunity->>'status','') <> 'research_pending' then
    raise exception 'opportunity payload must enter research_pending';
  end if;
  if coalesce(p_case->>'opportunityId','') <> p_opportunity_id or coalesce(v_case_id,'') = '' then
    raise exception 'research case does not match opportunity';
  end if;
  if jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'research tasks must be an array';
  end if;

  select *
    into v_existing
    from public.jhadina_opportunities
   where user_id = v_user and id = p_opportunity_id
   for update;

  if not found then
    raise exception 'opportunity not found';
  end if;

  if v_existing.status not in ('discovered','research_pending') then
    raise exception 'opportunity is not eligible to start research';
  end if;

  insert into public.jhadina_opportunity_research_cases (
    user_id, id, opportunity_id, title, status, created_at, updated_at
  ) values (
    v_user,
    v_case_id,
    p_opportunity_id,
    p_case->>'title',
    coalesce(p_case->>'status','pending'),
    coalesce((p_case->>'createdAt')::timestamptz, v_now),
    coalesce((p_case->>'updatedAt')::timestamptz, v_now)
  )
  on conflict (user_id, opportunity_id) do nothing;

  for v_task in select value from jsonb_array_elements(p_tasks)
  loop
    insert into public.jhadina_opportunity_research_tasks (
      user_id, id, research_case_id, kind, title, required, status,
      evidence_refs, created_at, completed_at
    ) values (
      v_user,
      v_task->>'id',
      v_case_id,
      v_task->>'kind',
      v_task->>'title',
      coalesce((v_task->>'required')::boolean, true),
      coalesce(v_task->>'status','pending'),
      coalesce(v_task->'evidenceRefs','[]'::jsonb),
      coalesce((v_task->>'createdAt')::timestamptz, v_now),
      nullif(v_task->>'completedAt','')::timestamptz
    )
    on conflict (user_id, research_case_id, kind) do nothing;
  end loop;

  update public.jhadina_opportunities
     set status = 'research_pending',
         approved_at = coalesce(approved_at, v_now),
         research_case_id = v_case_id,
         payload = p_opportunity,
         updated_at = v_now
   where user_id = v_user and id = p_opportunity_id;

  insert into public.jhadina_opportunity_outbox (
    user_id, event_id, opportunity_id, event_type, payload, created_at
  ) values (
    v_user,
    v_case_id || ':research_started',
    p_opportunity_id,
    'opportunity.research_started',
    jsonb_build_object(
      'opportunityId', p_opportunity_id,
      'researchCaseId', v_case_id,
      'status', 'research_pending'
    ),
    v_now
  )
  on conflict (user_id, event_id) do nothing;

  return jsonb_build_object(
    'userId', v_user,
    'opportunity', p_opportunity,
    'triageState', v_existing.triage_state,
    'approvedAt', coalesce(v_existing.approved_at, v_now),
    'researchCaseId', v_case_id
  );
end;
$$;

revoke all on function public.jhadina_opportunity_start_research(text, jsonb, jsonb, jsonb) from public;
grant execute on function public.jhadina_opportunity_start_research(text, jsonb, jsonb, jsonb) to authenticated;
