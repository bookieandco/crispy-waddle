-- SHARK-STALK.FINAL — durable scheduled StalkChain/FOMO research briefs.
-- Append-only research evidence. This table never stores or grants execution,
-- signing, custody, capital, permit, withdrawal, transfer, or broadcast authority.

create table if not exists public.jhadina_shark_stalkchain_research_briefs (
  brief_id text primary key,
  generated_at timestamptz not null,
  leaderboard_window text not null check (leaderboard_window in ('24h','7d','30d','all')),
  trader_count integer not null check (trader_count >= 0),
  emerging_count integer not null check (emerging_count >= 0),
  failure_count integer not null check (failure_count >= 0),
  provider_credits_remaining numeric null check (provider_credits_remaining is null or provider_credits_remaining >= 0),
  evidence_ids text[] not null check (cardinality(evidence_ids) > 0),
  source text not null check (length(btrim(source)) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists jhadina_shark_stalkchain_research_generated_idx
  on public.jhadina_shark_stalkchain_research_briefs (generated_at desc, brief_id);

alter table public.jhadina_shark_stalkchain_research_briefs enable row level security;

revoke all on public.jhadina_shark_stalkchain_research_briefs from public, anon, authenticated;
grant select, insert on public.jhadina_shark_stalkchain_research_briefs to service_role;
revoke update, delete on public.jhadina_shark_stalkchain_research_briefs from service_role;

create or replace function public.jhadina_shark_append_stalkchain_research_brief(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
begin
  insert into public.jhadina_shark_stalkchain_research_briefs (
    brief_id,
    generated_at,
    leaderboard_window,
    trader_count,
    emerging_count,
    failure_count,
    provider_credits_remaining,
    evidence_ids,
    source,
    payload
  ) values (
    p_payload->>'briefId',
    (p_payload->>'generatedAt')::timestamptz,
    p_payload->>'leaderboardWindow',
    (p_payload->>'traderCount')::integer,
    (p_payload->>'emergingCount')::integer,
    (p_payload->>'failureCount')::integer,
    nullif(p_payload->>'providerCreditsRemaining','')::numeric,
    array(select jsonb_array_elements_text(coalesce(p_payload->'evidenceIds','[]'::jsonb))),
    p_payload->>'source',
    p_payload
  )
  on conflict (brief_id) do nothing;

  if found then
    return 'INSERTED';
  end if;

  select payload into v_existing
    from public.jhadina_shark_stalkchain_research_briefs
    where brief_id = p_payload->>'briefId';

  if v_existing = p_payload then
    return 'REPLAY';
  end if;

  raise exception 'shark_stalkchain_research_brief_conflict';
end;
$$;

revoke all on function public.jhadina_shark_append_stalkchain_research_brief(jsonb) from public, anon, authenticated;
grant execute on function public.jhadina_shark_append_stalkchain_research_brief(jsonb) to service_role;
