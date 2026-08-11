create or replace function public.append_jhadina_evolution_run_ledger(
  p_run_id bigint,
  p_task_id text,
  p_type text,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns public.jhadina_evolution_run_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sequence integer;
  v_previous_hash text;
  v_event_id text;
  v_hash text;
  v_row public.jhadina_evolution_run_ledger;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text, 0));

  select coalesce(max(sequence), 0) + 1,
         (array_agg(hash order by sequence desc))[1]
    into v_sequence, v_previous_hash
    from public.jhadina_evolution_run_ledger
   where run_id = p_run_id;

  v_event_id := p_run_id::text || ':' || v_sequence::text;
  v_hash := encode(
    digest(
      jsonb_build_object(
        'runId', p_run_id,
        'taskId', p_task_id,
        'type', p_type,
        'occurredAt', p_occurred_at,
        'payload', p_payload,
        'sequence', v_sequence,
        'eventId', v_event_id,
        'previousHash', v_previous_hash
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.jhadina_evolution_run_ledger
    (run_id, sequence, event_id, task_id, type, occurred_at, payload, previous_hash, hash)
  values
    (p_run_id, v_sequence, v_event_id, p_task_id, p_type, p_occurred_at, p_payload, v_previous_hash, v_hash)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.append_jhadina_evolution_run_ledger(bigint, text, text, timestamptz, jsonb) from public;
