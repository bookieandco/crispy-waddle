-- A5-R4: close the durable SecurityCore audit-chain invariants without
-- creating a second audit store. The existing append RPC remains the single
-- writer boundary; this migration adds event-id idempotency and a scoped
-- integrity verifier over the same canonical chain.

create unique index if not exists jhadina_audit_event_domain_event_id_uidx
  on public.jhadina_audit_event (domain, event_id);

create or replace function public.verify_jhadina_audit_chain(
  p_domain text,
  p_actor_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_previous_hash text := 'GENESIS';
  v_expected_hash text;
  v_expected_sequence integer := 1;
begin
  if p_domain is null or p_actor_id is null then
    raise exception 'audit verify requires domain and actor_id';
  end if;

  if auth.uid() is null or auth.uid()::text <> p_actor_id then
    raise exception 'audit verify actor must match the authenticated caller';
  end if;

  for v_row in
    select *
      from public.jhadina_audit_event
     where domain = p_domain
     order by sequence asc
  loop
    if v_row.sequence <> v_expected_sequence
       or v_row.previous_hash <> v_previous_hash then
      return false;
    end if;

    v_expected_hash := encode(
      digest(
        jsonb_build_object(
          'eventId', v_row.event_id,
          'requestId', v_row.request_id,
          'actorId', v_row.actor_id,
          'domain', v_row.domain,
          'capability', v_row.capability,
          'decision', v_row.decision,
          'status', v_row.status,
          'occurredAt', v_row.occurred_at,
          'metadata', coalesce(v_row.metadata, '{}'::jsonb),
          'sequence', v_row.sequence,
          'previousHash', v_row.previous_hash
        )::text,
        'sha256'
      ),
      'hex'
    );

    if v_row.hash <> v_expected_hash then
      return false;
    end if;

    v_previous_hash := v_row.hash;
    v_expected_sequence := v_expected_sequence + 1;
  end loop;

  return true;
end;
$$;

revoke all on function public.verify_jhadina_audit_chain(text, text) from public;
grant execute on function public.verify_jhadina_audit_chain(text, text) to authenticated;
