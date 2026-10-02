-- LOCAL-GOV.PROD — terminalize exhausted external discovery on write.
--
-- Complements terminal-state monotonicity: even an obsolete worker that was
-- started before retry-exhaustion logic was deployed cannot create a new
-- attempt-12+ deferred row. The BEFORE UPDATE trigger rewrites it to blocked
-- with explicit provenance. Genuine later promotion to adapter_required/active
-- remains allowed.

create or replace function public.jhadina_preserve_terminal_source_discovery()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  external_retry_failure boolean;
begin
  external_retry_failure :=
    coalesce(new.last_error,'') ilike '%fetch failed%' or
    coalesce(new.last_error,'') ilike '%timeout%' or
    coalesce(new.last_error,'') ilike '%aborted%' or
    coalesce(new.last_error,'') like 'PUBLIC_SOURCE_WEB_SEARCH_HTTP_%' or
    coalesce(new.last_error,'') like 'PUBLIC_SOURCE_EXA_HTTP_%';

  if new.status in ('pending','discovered','deferred')
     and new.attempt_count >= 12
     and external_retry_failure then
    new.status := 'blocked';
    if new.last_error not like 'SOURCE_DISCOVERY_RETRY_EXHAUSTED:%' then
      new.last_error := 'SOURCE_DISCOVERY_RETRY_EXHAUSTED:' ||
        coalesce(new.last_error,'unknown external discovery failure');
    end if;
  end if;

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

update public.jhadina_public_source_discovery_jobs
set updated_at=now()
where status='deferred'
  and attempt_count >= 12
  and (
    coalesce(last_error,'') ilike '%fetch failed%' or
    coalesce(last_error,'') ilike '%timeout%' or
    coalesce(last_error,'') ilike '%aborted%' or
    coalesce(last_error,'') like 'PUBLIC_SOURCE_WEB_SEARCH_HTTP_%' or
    coalesce(last_error,'') like 'PUBLIC_SOURCE_EXA_HTTP_%'
  );
