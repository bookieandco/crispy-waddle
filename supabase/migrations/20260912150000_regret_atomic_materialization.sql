create or replace function public.jhadina_materialize_regret_atomic(
  p_user_id uuid,
  p_record jsonb
)
returns public.jhadina_regret_memory
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_root_cause text;
  v_recurrence_count integer;
  v_record jsonb;
  v_inserted public.jhadina_regret_memory;
begin
  if p_user_id is null then
    raise exception 'regret_atomic_user_id_required';
  end if;

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'regret_atomic_record_object_required';
  end if;

  if current_user <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'regret_atomic_user_scope_violation';
  end if;

  if (p_record->>'userId') is not null and (p_record->>'userId') <> p_user_id::text then
    raise exception 'regret_atomic_record_user_mismatch';
  end if;

  if p_record->'regret'->>'status' not in ('verified', 'learned') then
    raise exception 'regret_atomic_status_must_be_verified_or_learned';
  end if;

  v_root_cause := nullif(btrim(p_record->'regret'->>'rootCause'), '');

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_user_id::text || chr(31) || coalesce(v_root_cause, '<no-root-cause>'),
      0
    )
  );

  if v_root_cause is null then
    v_recurrence_count := 1;
  else
    select count(*)::integer
      into v_recurrence_count
      from public.jhadina_regret_memory r
     where r.user_id = p_user_id
       and r.regret->>'rootCause' = v_root_cause
       and r.regret->>'status' in ('verified', 'learned');

    v_recurrence_count := v_recurrence_count + 1;
  end if;

  v_record := jsonb_set(
    p_record,
    '{regret,recurrenceCount}',
    to_jsonb(v_recurrence_count),
    true
  );

  v_record := jsonb_set(v_record, '{userId}', to_jsonb(p_user_id::text), true);

  insert into public.jhadina_regret_memory (
    memory_id,
    user_id,
    regret,
    created_at,
    provenance,
    tags,
    salience,
    supersedes,
    superseded_by
  )
  values (
    v_record->>'memoryId',
    p_user_id,
    v_record->'regret',
    (v_record->>'createdAt')::timestamptz,
    coalesce(v_record->'provenance', '[]'::jsonb),
    coalesce(v_record->'tags', '[]'::jsonb),
    (v_record->>'salience')::numeric,
    nullif(v_record->>'supersedes', ''),
    nullif(v_record->>'supersededBy', '')
  )
  returning * into v_inserted;

  return v_inserted;
end;
$$;

revoke execute on function public.jhadina_materialize_regret_atomic(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.jhadina_materialize_regret_atomic(uuid, jsonb) to service_role;

comment on function public.jhadina_materialize_regret_atomic(uuid, jsonb) is
  'Atomically derives and appends a user-scoped verified regret recurrence. Uses a transaction advisory lock; historical regret rows remain append-only and prior recurrence counts are never mutated.';
