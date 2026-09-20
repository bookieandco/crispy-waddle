-- SHARK-QA.16E: evaluation receipt + canonical launch classification update are one transaction.
create or replace function public.jhadina_shark_apply_outcome_evaluation(
  p_evaluation jsonb,
  p_apply_outcome boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_launch_id text := p_evaluation->>'launch_id';
  v_evaluated_at timestamptz := (p_evaluation->>'evaluated_at')::timestamptz;
  v_evidence text[] := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_evaluation->'evidence_ids', '[]'::jsonb))),
    '{}'::text[]
  );
  v_reasons text[] := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_evaluation->'reasons', '[]'::jsonb))),
    '{}'::text[]
  );
begin
  insert into public.jhadina_launch_outcome_evaluations (
    evaluation_id, launch_id, previous_outcome, evaluated_outcome,
    confidence, evaluated_at, evaluator_version, evidence_ids, reasons
  ) values (
    p_evaluation->>'evaluation_id',
    v_launch_id,
    p_evaluation->>'previous_outcome',
    p_evaluation->>'evaluated_outcome',
    (p_evaluation->>'confidence')::numeric,
    v_evaluated_at,
    p_evaluation->>'evaluator_version',
    v_evidence,
    v_reasons
  )
  on conflict (evaluation_id) do nothing;

  if p_apply_outcome then
    update public.jhadina_token_launches l
       set outcome = p_evaluation->>'evaluated_outcome',
           outcome_observed_at = v_evaluated_at,
           evidence_ids = (
             select coalesce(array_agg(distinct evidence_id), '{}'::text[])
             from unnest(coalesce(l.evidence_ids, '{}'::text[]) || v_evidence) evidence_id
           ),
           updated_at = now()
     where l.launch_id = v_launch_id
       and (l.outcome_observed_at is null or v_evaluated_at >= l.outcome_observed_at);
  end if;
end;
$$;

revoke all on function public.jhadina_shark_apply_outcome_evaluation(jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.jhadina_shark_apply_outcome_evaluation(jsonb, boolean)
  to service_role;
