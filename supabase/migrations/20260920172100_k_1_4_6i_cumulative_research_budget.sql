-- K-1.4.6I cumulative budget carry across lease handoffs.

create or replace function public.jhadina_research_execution_lease_carry_usage()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare v_prev public.jhadina_research_execution_leases%rowtype;
begin
  select * into v_prev
  from public.jhadina_research_execution_leases
  where plan_id = new.plan_id
  order by created_at desc, id desc
  limit 1;

  if found then
    new.spent_cost := greatest(new.spent_cost, v_prev.spent_cost);
    new.accrued_risk := greatest(new.accrued_risk, v_prev.accrued_risk);
    new.query_count := greatest(new.query_count, v_prev.query_count);
    new.source_count := greatest(new.source_count, v_prev.source_count);
    new.evidence_count := greatest(new.evidence_count, v_prev.evidence_count);
    new.retry_count := greatest(new.retry_count, v_prev.retry_count);
    new.max_depth_seen := greatest(new.max_depth_seen, v_prev.max_depth_seen);
    new.max_breadth_seen := greatest(new.max_breadth_seen, v_prev.max_breadth_seen);
    new.wall_clock_ms := greatest(new.wall_clock_ms, v_prev.wall_clock_ms);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jhadina_research_lease_carry_usage on public.jhadina_research_execution_leases;
create trigger trg_jhadina_research_lease_carry_usage
before insert on public.jhadina_research_execution_leases
for each row execute function public.jhadina_research_execution_lease_carry_usage();

revoke execute on function public.jhadina_research_execution_lease_carry_usage() from public, anon, authenticated;

create or replace function public.jhadina_get_research_runtime_plan(p_plan_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'id', p.id,
    'intent_id', p.intent_id,
    'plan_version', p.plan_version,
    'tasks', coalesce((
      select jsonb_agg(
        task.value ||
        jsonb_build_object(
          'state', coalesce(s.state, 'ready'),
          'evidenceIds', coalesce(s.evidence_ids, '[]'::jsonb)
        )
        order by task.ordinality
      )
      from jsonb_array_elements(p.tasks) with ordinality as task(value, ordinality)
      left join public.jhadina_research_task_states s
        on s.plan_id = p.id and s.task_id = task.value->>'id'
    ), '[]'::jsonb),
    'budget', p.budget || jsonb_build_object(
      'spentCost', coalesce(u.spent_cost, 0),
      'accruedRisk', coalesce(u.accrued_risk, 0)
    ),
    'status', p.status
  )
  from public.jhadina_research_plans p
  left join lateral (
    select l.spent_cost, l.accrued_risk
    from public.jhadina_research_execution_leases l
    where l.plan_id = p.id
    order by l.created_at desc, l.id desc
    limit 1
  ) u on true
  where p.id = p_plan_id;
$$;

revoke execute on function public.jhadina_get_research_runtime_plan(uuid) from public, anon, authenticated;
grant execute on function public.jhadina_get_research_runtime_plan(uuid) to service_role;
