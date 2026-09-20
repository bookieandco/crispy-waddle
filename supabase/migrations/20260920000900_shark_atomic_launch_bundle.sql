-- SHARK-QA.16E: launch identity/provenance + actor edges are one transaction.
create or replace function public.jhadina_shark_persist_launch_bundle(
  p_launch jsonb,
  p_edges jsonb
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_launch_id text;
  v_edge jsonb;
  v_evidence text[];
  v_edge_evidence text[];
begin
  v_evidence := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_launch->'evidence_ids', '[]'::jsonb))),
    '{}'::text[]
  );

  insert into public.jhadina_token_launches (
    launch_id, chain_id, token_address, deployer_wallet_id, developer_entity_id,
    cluster_id, launched_at, launchpad, initial_liquidity_usd, outcome,
    outcome_observed_at, evidence_ids, source, observation_id, signature, slot, updated_at
  ) values (
    p_launch->>'launch_id', p_launch->>'chain_id', p_launch->>'token_address',
    nullif(p_launch->>'deployer_wallet_id',''), nullif(p_launch->>'developer_entity_id',''),
    nullif(p_launch->>'cluster_id',''), (p_launch->>'launched_at')::timestamptz,
    nullif(p_launch->>'launchpad',''), nullif(p_launch->>'initial_liquidity_usd','')::numeric,
    coalesce(nullif(p_launch->>'outcome',''), 'UNKNOWN'),
    nullif(p_launch->>'outcome_observed_at','')::timestamptz,
    v_evidence, p_launch->>'source', nullif(p_launch->>'observation_id',''),
    nullif(p_launch->>'signature',''), nullif(p_launch->>'slot','')::bigint, now()
  )
  on conflict (chain_id, token_address) do update set
    deployer_wallet_id = coalesce(excluded.deployer_wallet_id, jhadina_token_launches.deployer_wallet_id),
    developer_entity_id = coalesce(excluded.developer_entity_id, jhadina_token_launches.developer_entity_id),
    cluster_id = coalesce(excluded.cluster_id, jhadina_token_launches.cluster_id),
    launched_at = least(excluded.launched_at, jhadina_token_launches.launched_at),
    launchpad = coalesce(excluded.launchpad, jhadina_token_launches.launchpad),
    initial_liquidity_usd = coalesce(excluded.initial_liquidity_usd, jhadina_token_launches.initial_liquidity_usd),
    evidence_ids = (
      select coalesce(array_agg(distinct evidence_id), '{}'::text[])
      from unnest(coalesce(jhadina_token_launches.evidence_ids, '{}'::text[]) || excluded.evidence_ids) evidence_id
    ),
    source = excluded.source,
    observation_id = coalesce(excluded.observation_id, jhadina_token_launches.observation_id),
    signature = coalesce(excluded.signature, jhadina_token_launches.signature),
    slot = coalesce(excluded.slot, jhadina_token_launches.slot),
    -- Ingestion is outcome-neutral: never overwrite the outcome worker's state.
    outcome = jhadina_token_launches.outcome,
    outcome_observed_at = jhadina_token_launches.outcome_observed_at,
    updated_at = now()
  returning launch_id into v_launch_id;

  for v_edge in select value from jsonb_array_elements(coalesce(p_edges, '[]'::jsonb))
  loop
    v_edge_evidence := coalesce(
      array(select jsonb_array_elements_text(coalesce(v_edge->'evidence_ids', '[]'::jsonb))),
      '{}'::text[]
    );
    insert into public.jhadina_token_actor_edges (
      edge_id, launch_id, token_address, actor_id, actor_kind, role,
      confidence, observed_at, evidence_ids
    ) values (
      v_edge->>'edge_id', v_launch_id, p_launch->>'token_address',
      v_edge->>'actor_id', v_edge->>'actor_kind', v_edge->>'role',
      nullif(v_edge->>'confidence','')::numeric,
      (v_edge->>'observed_at')::timestamptz, v_edge_evidence
    )
    on conflict (edge_id) do update set
      confidence = greatest(
        coalesce(jhadina_token_actor_edges.confidence, 0),
        coalesce(excluded.confidence, 0)
      ),
      observed_at = least(jhadina_token_actor_edges.observed_at, excluded.observed_at),
      evidence_ids = (
        select coalesce(array_agg(distinct evidence_id), '{}'::text[])
        from unnest(coalesce(jhadina_token_actor_edges.evidence_ids, '{}'::text[]) || excluded.evidence_ids) evidence_id
      );
  end loop;

  return v_launch_id;
end;
$$;

revoke all on function public.jhadina_shark_persist_launch_bundle(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.jhadina_shark_persist_launch_bundle(jsonb, jsonb)
  to service_role;
