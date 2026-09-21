-- GROWTH-PROD lifecycle proposal mutation boundary.
-- Live production version: 20260921213205.

create or replace function growth_private.propose_lifecycle_action(
  p_customer_id uuid,
  p_action text,
  p_channel text,
  p_rationale text
)
returns public.jhadina_growth_lifecycle_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.jhadina_growth_lifecycle_proposals;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(
    select 1 from public.jhadina_growth_customers
    where id = p_customer_id and user_id = v_user
  ) then
    raise exception 'customer not found';
  end if;

  insert into public.jhadina_growth_lifecycle_proposals(
    user_id, customer_id, action, channel, rationale, status
  )
  values(v_user, p_customer_id, p_action, p_channel, trim(p_rationale), 'draft')
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.jhadina_growth_propose_lifecycle_action(
  p_customer_id uuid,
  p_action text,
  p_channel text,
  p_rationale text
)
returns public.jhadina_growth_lifecycle_proposals
language sql
security invoker
set search_path = ''
as $$
  select * from growth_private.propose_lifecycle_action(
    p_customer_id, p_action, p_channel, p_rationale
  )
$$;

revoke all on function growth_private.propose_lifecycle_action(uuid,text,text,text) from public;
grant execute on function growth_private.propose_lifecycle_action(uuid,text,text,text) to authenticated;
revoke execute on function public.jhadina_growth_propose_lifecycle_action(uuid,text,text,text) from public, anon;
grant execute on function public.jhadina_growth_propose_lifecycle_action(uuid,text,text,text) to authenticated;
