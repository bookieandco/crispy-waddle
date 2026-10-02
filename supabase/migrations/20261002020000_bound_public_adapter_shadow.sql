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

create or replace function public.jhadina_bound_public_source_discovery()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('pending','discovered')
     and coalesce(new.attempt_count,0) >= 5
     and (
       new.status = 'discovered'
       or coalesce(new.last_error,'') = 'fetch failed'
       or coalesce(new.last_error,'') ilike '%aborted due to timeout%'
       or coalesce(new.last_error,'') ilike '%network%'
     ) then
    new.status := 'blocked';
    if coalesce(new.last_error,'') = '' then
      new.last_error := 'PUBLIC_SOURCE_RETRY_BUDGET_EXHAUSTED';
    elsif new.last_error not like 'PUBLIC_SOURCE_RETRY_BUDGET_EXHAUSTED:%' then
      new.last_error := 'PUBLIC_SOURCE_RETRY_BUDGET_EXHAUSTED:' || new.last_error;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jhadina_bound_public_source_discovery_trg
  on public.jhadina_public_source_discovery_jobs;

create trigger jhadina_bound_public_source_discovery_trg
before insert or update of status,attempt_count,last_error
on public.jhadina_public_source_discovery_jobs
for each row
execute function public.jhadina_bound_public_source_discovery();

revoke all on function public.jhadina_bound_public_source_discovery() from public;
grant execute on function public.jhadina_bound_public_source_discovery() to service_role;

create or replace function public.jhadina_enforce_public_source_adapter_queue()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.adapter_status = 'adapter_required'
     and new.verification_status not in ('official_owner_verified','official_portal_verified') then
    if new.verification_status = 'rejected' then
      new.adapter_status := 'disabled';
      if not ('source_verification_rejected' = any(coalesce(new.blockers,array[]::text[]))) then
        new.blockers := coalesce(new.blockers,array[]::text[]) || array['source_verification_rejected'];
      end if;
    else
      new.adapter_status := 'degraded';
      if not ('source_verification_required' = any(coalesce(new.blockers,array[]::text[]))) then
        new.blockers := coalesce(new.blockers,array[]::text[]) || array['source_verification_required'];
      end if;
    end if;
  end if;

  if new.adapter_status = 'adapter_required'
     and new.verification_status in ('official_owner_verified','official_portal_verified')
     and new.adapter_kind in ('portal','pdf_index','search_form') then
    new.adapter_status := 'degraded';
    if not ('bounded_adapter_template_debt' = any(coalesce(new.blockers,array[]::text[]))) then
      new.blockers := coalesce(new.blockers,array[]::text[]) || array['bounded_adapter_template_debt'];
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jhadina_enforce_public_source_adapter_queue_trg
  on public.jhadina_public_procurement_sources;

create trigger jhadina_enforce_public_source_adapter_queue_trg
before insert or update of verification_status,adapter_status,adapter_kind
on public.jhadina_public_procurement_sources
for each row
execute function public.jhadina_enforce_public_source_adapter_queue();

revoke all on function public.jhadina_enforce_public_source_adapter_queue() from public;
grant execute on function public.jhadina_enforce_public_source_adapter_queue() to service_role;
