create or replace function public.jhadina_bound_public_adapter_shadow()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  total_trials integer := 0;
  successful_trials integer := 0;
  observed_rows bigint := 0;
begin
  if new.adapter_status <> 'adapter_required'
     or new.adapter_key is null
     or new.adapter_version is null then
    return new;
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where parse_succeeded
        and http_status between 200 and 299
        and provenance_complete
        and access_review_approved
    )::integer,
    coalesce(sum(observation_count) filter (
      where parse_succeeded
        and http_status between 200 and 299
        and provenance_complete
        and access_review_approved
    ),0)::bigint
  into total_trials, successful_trials, observed_rows
  from public.jhadina_public_adapter_trials
  where source_id = new.id
    and adapter_key = new.adapter_key
    and adapter_version = new.adapter_version;

  if total_trials >= 5
     and (successful_trials < 3 or observed_rows = 0) then
    new.adapter_status := 'degraded';
    if not ('bounded_shadow_retry_debt' = any(coalesce(new.blockers,array[]::text[]))) then
      new.blockers := coalesce(new.blockers,array[]::text[]) || array['bounded_shadow_retry_debt'];
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jhadina_bound_public_adapter_shadow_trg
  on public.jhadina_public_procurement_sources;

create trigger jhadina_bound_public_adapter_shadow_trg
before insert or update of adapter_status,adapter_key,adapter_version
on public.jhadina_public_procurement_sources
for each row
execute function public.jhadina_bound_public_adapter_shadow();

revoke all on function public.jhadina_bound_public_adapter_shadow() from public;
grant execute on function public.jhadina_bound_public_adapter_shadow() to service_role;
