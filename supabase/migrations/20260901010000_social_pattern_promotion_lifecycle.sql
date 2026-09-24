-- Lifecycle hardening for social-pattern promotions.
-- Promotions are monotonic: confidence may increase, provenance may not change,
-- and revocation is terminal. The RPC keeps these invariants atomic under races.

alter table public.growth_social_pattern_promotions
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text;

alter table public.growth_social_pattern_promotions
  drop constraint if exists growth_social_pattern_promotions_status_check;

alter table public.growth_social_pattern_promotions
  add constraint growth_social_pattern_promotions_status_check
  check (status in ('promoted', 'revoked'));

create or replace function public.upsert_social_pattern_promotion(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_id text := payload->>'id';
  existing public.growth_social_pattern_promotions%rowtype;
begin
  select * into existing
  from public.growth_social_pattern_promotions
  where id = incoming_id
  for update;

  if existing.id is not null then
    if existing.hypothesis_id <> payload->>'hypothesis_id'
      or existing.source_pattern_id <> payload->>'source_pattern_id'
      or existing.source_account_id <> payload->>'source_account_id'
      or existing.target_account_id <> payload->>'target_account_id'
      or existing.target_audience_id <> payload->>'target_audience_id'
      or existing.target_voice_id <> payload->>'target_voice_id'
      or existing.strategy <> payload->>'strategy'
      or existing.experiment_id <> payload->>'experiment_id'
    then
      raise exception 'promotion provenance is immutable';
    end if;

    if existing.status = 'revoked' then
      return;
    end if;

    update public.growth_social_pattern_promotions
    set confidence = greatest(existing.confidence, (payload->>'confidence')::numeric),
        promoted_at = least(existing.promoted_at, (payload->>'promoted_at')::timestamptz),
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
    payload->>'strategy', (payload->>'confidence')::numeric, 'promoted',
    'validated_experiment', payload->>'experiment_id',
    (payload->>'promoted_at')::timestamptz
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
begin
  update public.growth_social_pattern_promotions
  set status = 'revoked',
      revoked_at = coalesce(public.growth_social_pattern_promotions.revoked_at, $3),
      revocation_reason = coalesce(public.growth_social_pattern_promotions.revocation_reason, $2),
      updated_at = now()
  where id = $1;

  if not found then
    raise exception 'promotion not found';
  end if;
end;
$$;

revoke all on function public.upsert_social_pattern_promotion(jsonb) from public, anon, authenticated;
revoke all on function public.revoke_social_pattern_promotion(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.upsert_social_pattern_promotion(jsonb) to service_role;
grant execute on function public.revoke_social_pattern_promotion(text, text, timestamptz) to service_role;
