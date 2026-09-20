-- SHARK-QA.17B: evaluation receipts, canonical launch revisions, and derived actor
-- reputation cache updates commit as one transaction. Actor history is supplied by
-- the deterministic application evaluator but cannot become visible without its
-- corresponding canonical launch/evaluation state.

create or replace function public.jhadina_shark_apply_outcome_batch(
  p_evaluations jsonb,
  p_actor_histories jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evaluation jsonb;
  v_history jsonb;
  v_evidence text[];
  v_reasons text[];
  v_evaluated_at timestamptz;
  v_outcome_observed_at timestamptz;
begin
  if jsonb_typeof(coalesce(p_evaluations, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_actor_histories, '[]'::jsonb)) <> 'array' then
    raise exception 'SHARK outcome batch payloads must be arrays';
  end if;

  for v_evaluation in
    select value from jsonb_array_elements(coalesce(p_evaluations, '[]'::jsonb))
  loop
    v_evaluated_at := (v_evaluation->>'evaluated_at')::timestamptz;
    v_outcome_observed_at := coalesce(
      nullif(v_evaluation->>'outcome_observed_at', '')::timestamptz,
      v_evaluated_at
    );
    v_evidence := coalesce(
      array(select jsonb_array_elements_text(coalesce(v_evaluation->'evidence_ids', '[]'::jsonb))),
      '{}'::text[]
    );
    v_reasons := coalesce(
      array(select jsonb_array_elements_text(coalesce(v_evaluation->'reasons', '[]'::jsonb))),
      '{}'::text[]
    );

    insert into public.jhadina_launch_outcome_evaluations (
      evaluation_id, launch_id, previous_outcome, evaluated_outcome,
      confidence, evaluated_at, evaluator_version, evidence_ids, reasons
    ) values (
      v_evaluation->>'evaluation_id',
      v_evaluation->>'launch_id',
      v_evaluation->>'previous_outcome',
      v_evaluation->>'evaluated_outcome',
      (v_evaluation->>'confidence')::numeric,
      v_evaluated_at,
      v_evaluation->>'evaluator_version',
      v_evidence,
      v_reasons
    )
    on conflict (evaluation_id) do nothing;

    if (v_evaluation->>'evaluated_outcome') <> 'UNKNOWN' then
      update public.jhadina_token_launches l
         set outcome = v_evaluation->>'evaluated_outcome',
             outcome_observed_at = v_outcome_observed_at,
             evidence_ids = (
               select coalesce(array_agg(distinct evidence_id), '{}'::text[])
               from unnest(coalesce(l.evidence_ids, '{}'::text[]) || v_evidence) evidence_id
             ),
             updated_at = now()
       where l.launch_id = v_evaluation->>'launch_id'
         and (l.outcome_observed_at is null or v_outcome_observed_at >= l.outcome_observed_at);
    end if;
  end loop;

  for v_history in
    select value from jsonb_array_elements(coalesce(p_actor_histories, '[]'::jsonb))
  loop
    v_evidence := coalesce(
      array(select jsonb_array_elements_text(coalesce(v_history->'evidence_ids', '[]'::jsonb))),
      '{}'::text[]
    );

    insert into public.jhadina_actor_outcome_history (
      actor_key, actor_id, actor_kind, launches, healthy_launches, bad_launches,
      failed_launches, rug_rate, pump_and_dump_rate, outcome_coverage, confidence,
      association_confidence, evidence_ids, evaluated_at, evaluator_version, updated_at
    ) values (
      v_history->>'actor_key',
      v_history->>'actor_id',
      v_history->>'actor_kind',
      (v_history->>'launches')::integer,
      (v_history->>'healthy_launches')::integer,
      (v_history->>'bad_launches')::integer,
      (v_history->>'failed_launches')::integer,
      (v_history->>'rug_rate')::numeric,
      (v_history->>'pump_and_dump_rate')::numeric,
      (v_history->>'outcome_coverage')::numeric,
      (v_history->>'confidence')::numeric,
      (v_history->>'association_confidence')::numeric,
      v_evidence,
      (v_history->>'evaluated_at')::timestamptz,
      v_history->>'evaluator_version',
      now()
    )
    on conflict (actor_key) do update set
      actor_id = excluded.actor_id,
      actor_kind = excluded.actor_kind,
      launches = excluded.launches,
      healthy_launches = excluded.healthy_launches,
      bad_launches = excluded.bad_launches,
      failed_launches = excluded.failed_launches,
      rug_rate = excluded.rug_rate,
      pump_and_dump_rate = excluded.pump_and_dump_rate,
      outcome_coverage = excluded.outcome_coverage,
      confidence = excluded.confidence,
      association_confidence = excluded.association_confidence,
      evidence_ids = excluded.evidence_ids,
      evaluated_at = excluded.evaluated_at,
      evaluator_version = excluded.evaluator_version,
      updated_at = now();
  end loop;
end;
$$;

revoke all on function public.jhadina_shark_apply_outcome_batch(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.jhadina_shark_apply_outcome_batch(jsonb, jsonb)
  to service_role;
