-- LOCAL-GOV.PROD — preserve terminal source-discovery retry exhaustion.
--
-- Stale workers may finish after a newer convergence pass has terminalized a
-- repeatedly failing buyer. Preserve the terminal state against regression to
-- pending/discovered/deferred, while still allowing a later genuine source
-- discovery to promote the row to adapter_required/active.

create or replace function public.jhadina_preserve_terminal_source_discovery()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status = 'blocked'
     and old.last_error like 'SOURCE_DISCOVERY_RETRY_EXHAUSTED:%'
     and new.status in ('pending','discovered','deferred') then
    new.status := old.status;
    new.last_error := old.last_error;
    new.attempt_count := greatest(old.attempt_count,new.attempt_count);
  end if;
  return new;
end;
$$;

drop trigger if exists jhadina_preserve_terminal_source_discovery
  on public.jhadina_public_source_discovery_jobs;

create trigger jhadina_preserve_terminal_source_discovery
before update on public.jhadina_public_source_discovery_jobs
for each row
execute function public.jhadina_preserve_terminal_source_discovery();

update public.jhadina_public_source_discovery_jobs
set status='blocked',
    last_error=case
      when last_error like 'SOURCE_DISCOVERY_RETRY_EXHAUSTED:%' then last_error
      else 'SOURCE_DISCOVERY_RETRY_EXHAUSTED:' || coalesce(last_error,'unknown external discovery failure')
    end,
    updated_at=now()
where status='deferred'
  and attempt_count >= 12
  and (
    coalesce(last_error,'') ilike '%fetch failed%' or
    coalesce(last_error,'') ilike '%timeout%' or
    coalesce(last_error,'') ilike '%aborted%' or
    coalesce(last_error,'') like 'PUBLIC_SOURCE_WEB_SEARCH_HTTP_%' or
    coalesce(last_error,'') like 'PUBLIC_SOURCE_EXA_HTTP_%'
  );
