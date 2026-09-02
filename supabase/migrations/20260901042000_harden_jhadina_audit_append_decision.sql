-- A5-R9 migration-chain repair: the 20260901031000 idempotent audit
-- append function still rejected approval_required even after the table
-- constraint was expanded in 20260901032000. Keep the original migration
-- immutable and repair the live function with a forward migration.

CREATE OR REPLACE FUNCTION public.append_jhadina_audit_event(
  p_event_id text,
  p_request_id text,
  p_actor_id text,
  p_domain text,
  p_capability text,
  p_decision text,
  p_status text,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
RETURNS public.jhadina_audit_event
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sequence integer;
  v_previous_hash text;
  v_hash text;
  v_row public.jhadina_audit_event;
  v_existing public.jhadina_audit_event;
begin
  if p_event_id is null or p_request_id is null or p_actor_id is null or p_domain is null
     or p_capability is null or p_decision is null or p_status is null or p_occurred_at is null then
    raise exception 'audit append requires event_id, request_id, actor_id, domain, capability, decision, status, and occurred_at';
  end if;

  if p_decision not in ('allow', 'deny', 'approval_required') then
    raise exception 'invalid audit decision: %', p_decision;
  end if;

  if p_status not in ('started', 'approval_required', 'completed', 'denied', 'failed') then
    raise exception 'invalid audit status: %', p_status;
  end if;

  if auth.uid() is null or auth.uid()::text <> p_actor_id then
    raise exception 'audit append actor must match the authenticated caller';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_domain, 0));

  select * into v_existing
    from public.jhadina_audit_event
   where domain = p_domain and event_id = p_event_id;

  if found then
    if v_existing.request_id <> p_request_id
       or v_existing.actor_id <> p_actor_id
       or v_existing.capability <> p_capability
       or v_existing.decision <> p_decision
       or v_existing.status <> p_status
       or v_existing.occurred_at <> p_occurred_at
       or v_existing.metadata <> coalesce(p_metadata, '{}'::jsonb) then
      raise exception 'audit event id already exists with different content';
    end if;
    return v_existing;
  end if;

  select coalesce(max(sequence), 0) + 1,
         coalesce((array_agg(hash order by sequence desc))[1], 'GENESIS')
    into v_sequence, v_previous_hash
    from public.jhadina_audit_event
   where domain = p_domain;

  v_hash := encode(
    digest(
      jsonb_build_object(
        'eventId', p_event_id,
        'requestId', p_request_id,
        'actorId', p_actor_id,
        'domain', p_domain,
        'capability', p_capability,
        'decision', p_decision,
        'status', p_status,
        'occurredAt', p_occurred_at,
        'metadata', coalesce(p_metadata, '{}'::jsonb),
        'sequence', v_sequence,
        'previousHash', v_previous_hash
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.jhadina_audit_event
    (domain, sequence, event_id, request_id, actor_id, capability, decision, status, occurred_at, metadata, previous_hash, hash)
  values
    (p_domain, v_sequence, p_event_id, p_request_id, p_actor_id, p_capability, p_decision, p_status, p_occurred_at, coalesce(p_metadata, '{}'::jsonb), v_previous_hash, v_hash)
  returning * into v_row;

  return v_row;
end;
$$;

REVOKE ALL ON FUNCTION public.append_jhadina_audit_event(text, text, text, text, text, text, text, timestamptz, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.append_jhadina_audit_event(text, text, text, text, text, text, text, timestamptz, jsonb) TO authenticated;
