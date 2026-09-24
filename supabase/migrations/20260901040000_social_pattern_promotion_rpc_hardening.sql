-- RPC hardening for durable social-pattern promotion lifecycle.
-- Keep the trusted service-role boundary, but make malformed/stale inputs fail
-- closed instead of relying on nullable SQL comparisons or downstream checks.

create or replace function public.upsert_social_pattern_promotion(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_id text := payload->>'id';
  incoming_confidence numeric := (payload->>'confidence')::numeric;
  incoming_promoted_at timestamptz := (payload->>'promoted_at')::timestamptz;
  existing public.growth_social_pattern_promotions%rowtype;
begin
  if nullif(trim(incoming_id), '') is null
     or nullif(trim(payload->>'hypothesis_id'), '') is null
     or nullif(trim(payload->>'source_pattern_id'), '') is null
     or nullif(trim(payload->>'source_account_id'), '') is null
     or nullif(trim(payload->>'target_account_id'), '') is null
     or nullif(trim(payload->>'target_audience_id'), '') is null
     or nullif(trim(payload->>'target_voice_id'), '') is null
     or nullif(trim(payload->>'strategy'), '') is null
     or nullif(trim(payload->>'experiment_id'), '') is null
     or payload->>'status' is distinct from 'promoted'
     or payload->>'source' is distinct from 'validated_experiment'
     or incoming_confidence is null
     or incoming_confidence < 0
     or incoming_confidence > 1
     or incoming_promoted_at is null
  then
    raise exception 'invalid promotion payload';
  end if;

  select * into existing
  from public.growth_social_pattern_promotions
  where id = incoming_id
  for update;

  if existing.id is not null then
    if existing.hypothesis_id is distinct from payload->>'hypothesis_id'
      or existing.source_pattern_id is distinct from payload->>'source_pattern_id'
      or existing.source_account_id is distinct from payload->>'source_account_id'
      or existing.target_account_id is distinct from payload->>'target_account_id'
      or existing.target_audience_id is distinct from payload->>'target_audience_id'
      or existing.target_voice_id is distinct from payload->>'target_voice_id'
      or existing.strategy is distinct from payload->>'strategy'
      or existing.experiment_id is distinct from payload->>'experiment_id'
    then
      raise exception 'promotion provenance is immutable';
    end if;

    if existing.status = 'revoked' then
      return;
    end if;

    update public.growth_social_pattern_promotions
    set confidence = greatest(existing.confidence, incoming_confidence),
        promoted_at = least(existing.promoted_at, incoming_promoted_at),
        updated_at = now()
    where id = incoming_id;
    return;
  end if;

  insert into public.growth_social_pattern_promotions (
    id, hypothesis_id, source_pattern_id, source_account_id,
    target_account_id, target_audience_id, target_voice_id,
    strategy, confidence, status, source, experiment_id, promoted_at
  ) values (
    incoming_id, payload->>'hypothesis_id', payload->>'source_pattern_id',
    payload->>'source_account_id', payload->>'target_account_id',
    payload->>'target_audience_id', payload->>'target_voice_id',
    payload->>'strategy', incoming_confidence, 'promoted',
    'validated_experiment', payload->>'experiment_id', incoming_promoted_at
  );
end;
$$;

create or replace function public.revoke_social_pattern_promotion(
  promotion_id text,
  reason text,
  revoked_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.growth_social_pattern_promotions%rowtype;
begin
  if nullif(trim(promotion_id), '') is null
     or nullif(trim(reason), '') is null
     or revoked_at is null
  then
    raise exception 'invalid promotion revocation';
  end if;

  select * into existing
  from public.growth_social_pattern_promotions
  where id = promotion_id
  for update;

  if existing.id is null then
    raise exception 'promotion not found';
  end if;

  if existing.status = 'revoked' then
    return;
  end if;

  if revoked_at < existing.promoted_at then
    raise exception 'revocation timestamp predates promotion';
  end if;

  update public.growth_social_pattern_promotions
  set status = 'revoked',
      revoked_at = revoked_at,
      revocation_reason = reason,
      updated_at = now()
  where id = promotion_id;
end;
$$;

revoke all on function public.upsert_social_pattern_promotion(jsonb) from public, anon, authenticated;
revoke all on function public.revoke_social_pattern_promotion(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.upsert_social_pattern_promotion(jsonb) to service_role;
grant execute on function public.revoke_social_pattern_promotion(text, text, timestamptz) to service_role;
