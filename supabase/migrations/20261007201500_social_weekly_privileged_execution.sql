-- SOCIAL-JUGGERNAUT.24 — privileged weekly scheduler execution bridge.
-- Source-only until SWLC production storage/health is recovered.
--
-- Service-role-only functions bridge an approved immutable weekly packet into
-- the existing Social/Growth proposal -> child approval -> outbox runtimes.
-- They do not bypass provider, idempotency, owner, budget, or fingerprint gates.

create or replace function public.jhadina_social_weekly_prepare_proposal(
  p_user_id uuid,
  p_packet_id text,
  p_permit_id text,
  p_action_id text,
  p_action_fingerprint text,
  p_brand text,
  p_text text,
  p_media_urls jsonb,
  p_scheduled_at timestamptz,
  p_target_account_ids uuid[],
  p_request_fingerprint text,
  p_idempotency_key text,
  p_approval_expires_at timestamptz
)
returns public.jhadina_social_publication_proposals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proposal public.jhadina_social_publication_proposals;
  v_receipt public.jhadina_social_approval_receipts;
  v_requested_count integer;
  v_eligible_count integer;
  v_child_action_id text;
  v_child_fingerprint text;
  v_existing_targets uuid[];
  v_requested_targets uuid[];
begin
  if p_user_id is null then
    raise exception 'SOCIAL_WEEKLY_OWNER_REQUIRED';
  end if;
  if nullif(trim(p_packet_id), '') is null
     or nullif(trim(p_permit_id), '') is null
     or nullif(trim(p_action_id), '') is null
     or nullif(trim(p_action_fingerprint), '') is null then
    raise exception 'SOCIAL_WEEKLY_ACTION_IDENTITY_REQUIRED';
  end if;
  if nullif(trim(p_brand), '') is null
     or nullif(trim(p_text), '') is null then
    raise exception 'SOCIAL_WEEKLY_CONTENT_REQUIRED';
  end if;
  if p_target_account_ids is null or cardinality(p_target_account_ids) = 0 then
    raise exception 'SOCIAL_WEEKLY_TARGETS_REQUIRED';
  end if;
  if nullif(trim(p_request_fingerprint), '') is null
     or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'SOCIAL_WEEKLY_PROPOSAL_FINGERPRINT_REQUIRED';
  end if;
  if p_scheduled_at is null then
    raise exception 'SOCIAL_WEEKLY_SCHEDULE_REQUIRED';
  end if;
  if p_media_urls is not null and jsonb_typeof(p_media_urls) <> 'array' then
    raise exception 'SOCIAL_WEEKLY_MEDIA_ARRAY_REQUIRED';
  end if;

  if not exists (
    select 1
      from public.jhadina_social_weekly_packets p
      join public.jhadina_social_weekly_action_state a
        on a.user_id = p.user_id
       and a.packet_id = p.id
     where p.user_id = p_user_id
       and p.id = p_packet_id
       and p.status in ('approved','active')
       and p.approved_at is not null
       and p.week_starts_at <= p_scheduled_at
       and p.week_ends_at > p_scheduled_at
       and p.week_ends_at > now()
       and a.action_id = p_action_id
       and a.action_kind = 'organic_publication'
       and a.permit_id = p_permit_id
       and a.action_fingerprint = p_action_fingerprint
       and a.scheduled_at = p_scheduled_at
       and a.status not in ('completed','cancelled')
  ) then
    raise exception 'SOCIAL_WEEKLY_PREPARE_ACTION_NOT_APPROVED';
  end if;

  if p_approval_expires_at is null
     or p_approval_expires_at <= now()
     or p_approval_expires_at > (
       select week_ends_at
         from public.jhadina_social_weekly_packets
        where user_id = p_user_id and id = p_packet_id
     ) then
    raise exception 'SOCIAL_WEEKLY_PREPARE_EXPIRY_INVALID';
  end if;

  v_requested_count := cardinality(p_target_account_ids);
  if v_requested_count <> (
    select count(distinct value)
      from unnest(p_target_account_ids) as value
  ) then
    raise exception 'SOCIAL_WEEKLY_DUPLICATE_TARGET';
  end if;

  select count(*) into v_eligible_count
    from public.jhadina_social_accounts
   where user_id = p_user_id
     and id = any(p_target_account_ids)
     and brand = trim(p_brand)
     and status = 'connected';

  if v_eligible_count <> v_requested_count then
    raise exception 'SOCIAL_WEEKLY_TARGET_OWNERSHIP_OR_BRAND_MISMATCH';
  end if;

  select array_agg(value order by value)
    into v_requested_targets
    from unnest(p_target_account_ids) as value;

  select * into v_proposal
    from public.jhadina_social_publication_proposals
   where user_id = p_user_id
     and idempotency_key = p_idempotency_key;

  if v_proposal.id is not null then
    select array_agg(account_id order by account_id)
      into v_existing_targets
      from public.jhadina_social_publication_targets
     where proposal_id = v_proposal.id
       and user_id = p_user_id;

    if v_proposal.request_fingerprint <> p_request_fingerprint
       or v_proposal.brand <> trim(p_brand)
       or v_proposal.text <> trim(p_text)
       or v_proposal.scheduled_at is distinct from p_scheduled_at
       or v_proposal.media_urls <> coalesce(p_media_urls, '[]'::jsonb)
       or v_existing_targets is distinct from v_requested_targets then
      raise exception 'SOCIAL_WEEKLY_PREPARE_IDEMPOTENCY_CONFLICT';
    end if;
    return v_proposal;
  end if;

  v_child_action_id :=
    'social-weekly-publish:' || p_packet_id || ':' || p_action_id;

  insert into public.jhadina_social_publication_proposals(
    user_id, action_id, brand, text, media_urls, scheduled_at,
    request_fingerprint, idempotency_key
  )
  values(
    p_user_id, v_child_action_id, trim(p_brand), trim(p_text),
    coalesce(p_media_urls, '[]'::jsonb), p_scheduled_at,
    p_request_fingerprint, p_idempotency_key
  )
  returning * into v_proposal;

  insert into public.jhadina_social_publication_targets(
    proposal_id, user_id, account_id, brand, provider,
    provider_profile_id, platform
  )
  select v_proposal.id, p_user_id, account.id, account.brand,
         account.provider, account.provider_profile_id, account.platform
    from public.jhadina_social_accounts account
   where account.user_id = p_user_id
     and account.id = any(p_target_account_ids)
     and account.brand = trim(p_brand)
     and account.status = 'connected';

  v_child_fingerprint :=
    'social-public-publish:v1:' || v_proposal.id::text || ':' ||
    v_proposal.request_fingerprint;

  insert into public.jhadina_social_approval_receipts(
    action_id, user_id, type, fingerprint, expires_at
  )
  values(
    v_proposal.action_id, p_user_id, 'public.publish',
    v_child_fingerprint, p_approval_expires_at
  )
  returning * into v_receipt;

  update public.jhadina_social_publication_proposals
     set approval_receipt_id = v_receipt.id,
         updated_at = now()
   where id = v_proposal.id
     and user_id = p_user_id
  returning * into v_proposal;

  return v_proposal;
end;
$$;

create or replace function public.jhadina_growth_weekly_prepare_paid_campaign(
  p_user_id uuid,
  p_packet_id text,
  p_permit_id text,
  p_action_id text,
  p_action_fingerprint text,
  p_growth_action_id text,
  p_brand_id text,
  p_name text,
  p_objective text,
  p_channel text,
  p_provider text,
  p_provider_account_id text,
  p_audience_ids jsonb,
  p_creative_ids jsonb,
  p_landing_page_id text,
  p_currency text,
  p_daily_budget_minor bigint,
  p_lifetime_budget_minor bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_request_fingerprint text,
  p_idempotency_key text,
  p_approval_expires_at timestamptz
)
returns public.jhadina_growth_paid_campaigns
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.jhadina_growth_paid_campaigns;
  v_receipt public.jhadina_growth_approval_receipts;
  v_child_fingerprint text;
begin
  if p_user_id is null then
    raise exception 'GROWTH_WEEKLY_OWNER_REQUIRED';
  end if;
  if nullif(trim(p_packet_id), '') is null
     or nullif(trim(p_permit_id), '') is null
     or nullif(trim(p_action_id), '') is null
     or nullif(trim(p_action_fingerprint), '') is null
     or nullif(trim(p_growth_action_id), '') is null
     or nullif(trim(p_request_fingerprint), '') is null
     or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'GROWTH_WEEKLY_PREPARE_IDENTITY_REQUIRED';
  end if;
  if nullif(trim(p_brand_id), '') is null
     or nullif(trim(p_name), '') is null
     or nullif(trim(p_objective), '') is null
     or nullif(trim(p_provider), '') is null
     or nullif(trim(p_provider_account_id), '') is null then
    raise exception 'GROWTH_WEEKLY_PREPARE_FIELDS_REQUIRED';
  end if;
  if p_channel not in (
    'meta','google','tiktok','linkedin','reddit',
    'microsoft','pinterest','snapchat','amazon','dv360'
  ) then
    raise exception 'GROWTH_WEEKLY_PREPARE_CHANNEL_INVALID';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'GROWTH_WEEKLY_PREPARE_CURRENCY_INVALID';
  end if;
  if p_audience_ids is null
     or jsonb_typeof(p_audience_ids) <> 'array'
     or jsonb_array_length(p_audience_ids) = 0 then
    raise exception 'GROWTH_WEEKLY_PREPARE_AUDIENCE_REQUIRED';
  end if;
  if p_creative_ids is null
     or jsonb_typeof(p_creative_ids) <> 'array'
     or jsonb_array_length(p_creative_ids) = 0 then
    raise exception 'GROWTH_WEEKLY_PREPARE_CREATIVE_REQUIRED';
  end if;
  if jsonb_array_length(p_audience_ids) <> (
    select count(distinct value)
      from jsonb_array_elements_text(p_audience_ids)
  ) then
    raise exception 'GROWTH_WEEKLY_PREPARE_DUPLICATE_AUDIENCE';
  end if;
  if jsonb_array_length(p_creative_ids) <> (
    select count(distinct value)
      from jsonb_array_elements_text(p_creative_ids)
  ) then
    raise exception 'GROWTH_WEEKLY_PREPARE_DUPLICATE_CREATIVE';
  end if;
  if p_daily_budget_minor is null
     or p_daily_budget_minor <= 0
     or (
       p_lifetime_budget_minor is not null
       and p_lifetime_budget_minor < p_daily_budget_minor
     ) then
    raise exception 'GROWTH_WEEKLY_PREPARE_BUDGET_INVALID';
  end if;
  if p_starts_at is not null
     and p_ends_at is not null
     and p_ends_at <= p_starts_at then
    raise exception 'GROWTH_WEEKLY_PREPARE_WINDOW_INVALID';
  end if;

  if not exists (
    select 1
      from public.jhadina_social_weekly_packets p
      join public.jhadina_social_weekly_action_state a
        on a.user_id = p.user_id
       and a.packet_id = p.id
     where p.user_id = p_user_id
       and p.id = p_packet_id
       and p.status in ('approved','active')
       and p.approved_at is not null
       and p.week_ends_at > now()
       and a.action_id = p_action_id
       and a.action_kind = 'paid_campaign'
       and a.permit_id = p_permit_id
       and a.action_fingerprint = p_action_fingerprint
       and a.status not in ('completed','cancelled')
  ) then
    raise exception 'GROWTH_WEEKLY_PREPARE_ACTION_NOT_APPROVED';
  end if;

  if p_approval_expires_at is null
     or p_approval_expires_at <= now()
     or p_approval_expires_at > (
       select week_ends_at
         from public.jhadina_social_weekly_packets
        where user_id = p_user_id and id = p_packet_id
     ) then
    raise exception 'GROWTH_WEEKLY_PREPARE_EXPIRY_INVALID';
  end if;

  select * into v_campaign
    from public.jhadina_growth_paid_campaigns
   where user_id = p_user_id
     and idempotency_key = p_idempotency_key;

  if v_campaign.id is not null then
    if v_campaign.request_fingerprint <> p_request_fingerprint
       or v_campaign.action_id <> p_growth_action_id
       or v_campaign.brand_id <> trim(p_brand_id)
       or v_campaign.name <> trim(p_name)
       or v_campaign.objective <> trim(p_objective)
       or v_campaign.channel <> p_channel
       or v_campaign.provider <> trim(p_provider)
       or v_campaign.provider_account_id <> trim(p_provider_account_id)
       or v_campaign.audience_ids <> p_audience_ids
       or v_campaign.creative_ids <> p_creative_ids
       or v_campaign.landing_page_id is distinct from p_landing_page_id
       or v_campaign.currency <> p_currency
       or v_campaign.daily_budget_minor <> p_daily_budget_minor
       or v_campaign.lifetime_budget_minor is distinct from p_lifetime_budget_minor
       or v_campaign.starts_at is distinct from p_starts_at
       or v_campaign.ends_at is distinct from p_ends_at then
      raise exception 'GROWTH_WEEKLY_PREPARE_IDEMPOTENCY_CONFLICT';
    end if;
    return v_campaign;
  end if;

  insert into public.jhadina_growth_paid_campaigns(
    user_id, action_id, brand_id, name, objective, channel,
    provider, provider_account_id, audience_ids, creative_ids,
    landing_page_id, currency, daily_budget_minor, lifetime_budget_minor,
    starts_at, ends_at, request_fingerprint, idempotency_key
  )
  values(
    p_user_id, p_growth_action_id, trim(p_brand_id), trim(p_name),
    trim(p_objective), p_channel, trim(p_provider),
    trim(p_provider_account_id), p_audience_ids, p_creative_ids,
    p_landing_page_id, p_currency, p_daily_budget_minor,
    p_lifetime_budget_minor, p_starts_at, p_ends_at,
    p_request_fingerprint, p_idempotency_key
  )
  returning * into v_campaign;

  v_child_fingerprint :=
    'growth-paid-publish:v1:' || v_campaign.id::text || ':' ||
    v_campaign.request_fingerprint;

  insert into public.jhadina_growth_approval_receipts(
    user_id, campaign_id, action_id, type, fingerprint, expires_at
  )
  values(
    p_user_id, v_campaign.id, v_campaign.action_id,
    'paid-ad.publish', v_child_fingerprint, p_approval_expires_at
  )
  returning * into v_receipt;

  update public.jhadina_growth_paid_campaigns
     set approval_receipt_id = v_receipt.id,
         updated_at = now()
   where id = v_campaign.id
     and user_id = p_user_id
  returning * into v_campaign;

  return v_campaign;
end;
$$;

create or replace function public.jhadina_social_consume_weekly_publication_delegation(
  p_user_id uuid,
  p_packet_id text,
  p_permit_id text,
  p_action_id text,
  p_action_fingerprint text,
  p_proposal_id uuid,
  p_consumed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proposal public.jhadina_social_publication_proposals;
  v_receipt public.jhadina_social_approval_receipts;
  v_expected text;
  v_inserted text;
begin
  if p_consumed_at is null then
    raise exception 'SOCIAL_WEEKLY_DELEGATION_CONSUMED_AT_REQUIRED';
  end if;

  if not exists (
    select 1
      from public.jhadina_social_weekly_packets p
      join public.jhadina_social_weekly_action_state a
        on a.user_id = p.user_id
       and a.packet_id = p.id
     where p.user_id = p_user_id
       and p.id = p_packet_id
       and p.status in ('approved','active')
       and p.approved_at is not null
       and p.approved_at <= p_consumed_at
       and p.week_ends_at > p_consumed_at
       and a.action_id = p_action_id
       and a.action_kind = 'organic_publication'
       and a.permit_id = p_permit_id
       and a.action_fingerprint = p_action_fingerprint
       and a.status not in ('completed','cancelled')
  ) then
    return false;
  end if;

  select * into v_proposal
    from public.jhadina_social_publication_proposals
   where id = p_proposal_id
     and user_id = p_user_id
     and status = 'pending_approval';

  if v_proposal.id is null or v_proposal.approval_receipt_id is null then
    return false;
  end if;

  v_expected :=
    'social-public-publish:v1:' || v_proposal.id::text || ':' ||
    v_proposal.request_fingerprint;

  select * into v_receipt
    from public.jhadina_social_approval_receipts
   where id = v_proposal.approval_receipt_id
     and user_id = p_user_id
     and action_id = v_proposal.action_id
     and type = 'public.publish'
     and fingerprint = v_expected
     and status in ('pending','approved')
     and expires_at > p_consumed_at;

  if v_receipt.id is null then
    return false;
  end if;

  insert into public.jhadina_social_weekly_permit_consumptions(
    user_id, permit_id, packet_id, action_id, action_fingerprint, consumed_at
  )
  values(
    p_user_id, p_permit_id, p_packet_id, p_action_id,
    p_action_fingerprint, p_consumed_at
  )
  on conflict (user_id, permit_id) do nothing
  returning permit_id into v_inserted;

  if v_inserted is null then
    return false;
  end if;

  update public.jhadina_social_approval_receipts
     set status = 'consumed',
         approved_at = coalesce(approved_at, p_consumed_at),
         consumed_at = p_consumed_at
   where id = v_receipt.id
     and user_id = p_user_id
     and status in ('pending','approved')
     and expires_at > p_consumed_at;

  if not found then
    raise exception 'SOCIAL_WEEKLY_CHILD_RECEIPT_CONSUME_FAILED';
  end if;

  return true;
end;
$$;

create or replace function public.jhadina_social_weekly_enqueue_outbox(
  p_user_id uuid,
  p_proposal_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
begin
  if not exists (
    select 1
      from public.jhadina_social_publication_proposals proposal
      join public.jhadina_social_approval_receipts receipt
        on receipt.id = proposal.approval_receipt_id
       and receipt.user_id = proposal.user_id
       and receipt.action_id = proposal.action_id
     where proposal.id = p_proposal_id
       and proposal.user_id = p_user_id
       and proposal.status = 'pending_approval'
       and receipt.type = 'public.publish'
       and receipt.status = 'consumed'
       and receipt.fingerprint =
         'social-public-publish:v1:' || proposal.id::text || ':' ||
         proposal.request_fingerprint
  ) then
    raise exception 'SOCIAL_WEEKLY_CONSUMED_CHILD_APPROVAL_REQUIRED';
  end if;

  insert into public.jhadina_social_outbox(
    proposal_id, target_id, account_id, user_id, action_id, brand, provider,
    provider_profile_id, platform, text, media_urls, scheduled_at,
    idempotency_key
  )
  select proposal.id, target.id, target.account_id, proposal.user_id,
         proposal.action_id, target.brand, target.provider,
         target.provider_profile_id, target.platform, proposal.text,
         proposal.media_urls, proposal.scheduled_at,
         proposal.id::text || ':' || target.account_id::text
    from public.jhadina_social_publication_proposals proposal
    join public.jhadina_social_publication_targets target
      on target.proposal_id = proposal.id
     and target.user_id = proposal.user_id
   where proposal.id = p_proposal_id
     and proposal.user_id = p_user_id
  on conflict (user_id, idempotency_key) do nothing;

  get diagnostics inserted_count = row_count;

  update public.jhadina_social_publication_proposals
     set status = 'queued',
         updated_at = now()
   where id = p_proposal_id
     and user_id = p_user_id
     and status = 'pending_approval';

  return inserted_count;
end;
$$;

create or replace function public.jhadina_social_weekly_begin_outbox_attempt(
  p_user_id uuid,
  p_outbox_id uuid
)
returns public.jhadina_social_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.jhadina_social_outbox;
begin
  update public.jhadina_social_outbox
     set status = 'attempting',
         attempt_count = attempt_count + 1,
         last_error = null,
         updated_at = now()
   where id = p_outbox_id
     and user_id = p_user_id
     and status in ('pending','failed')
  returning * into result;

  if result.id is null then
    raise exception 'SOCIAL_WEEKLY_OUTBOX_NOT_ATTEMPTABLE';
  end if;

  return result;
end;
$$;

create or replace function public.jhadina_social_weekly_complete_outbox(
  p_user_id uuid,
  p_outbox_id uuid,
  p_provider_post_id text
)
returns public.jhadina_social_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.jhadina_social_outbox;
begin
  if nullif(trim(p_provider_post_id), '') is null then
    raise exception 'SOCIAL_WEEKLY_PROVIDER_POST_ID_REQUIRED';
  end if;

  update public.jhadina_social_outbox
     set status = 'delivered',
         provider_post_id = trim(p_provider_post_id),
         last_error = null,
         updated_at = now()
   where id = p_outbox_id
     and user_id = p_user_id
     and status = 'attempting'
  returning * into result;

  if result.id is null then
    raise exception 'SOCIAL_WEEKLY_OUTBOX_NOT_COMPLETABLE';
  end if;

  perform public.jhadina_social_refresh_proposal_status(result.proposal_id);
  return result;
end;
$$;

create or replace function public.jhadina_social_weekly_fail_outbox(
  p_user_id uuid,
  p_outbox_id uuid,
  p_error text,
  p_ambiguous boolean default false,
  p_provider_post_id text default null
)
returns public.jhadina_social_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.jhadina_social_outbox;
begin
  update public.jhadina_social_outbox
     set status = case when p_ambiguous then 'ambiguous' else 'failed' end,
         provider_post_id = coalesce(
           nullif(trim(p_provider_post_id), ''),
           provider_post_id
         ),
         last_error = left(coalesce(nullif(trim(p_error), ''), 'provider failure'), 1000),
         updated_at = now()
   where id = p_outbox_id
     and user_id = p_user_id
     and status = 'attempting'
  returning * into result;

  if result.id is null then
    raise exception 'SOCIAL_WEEKLY_OUTBOX_NOT_FAILABLE';
  end if;

  perform public.jhadina_social_refresh_proposal_status(result.proposal_id);
  return result;
end;
$$;

create or replace function public.jhadina_growth_consume_weekly_paid_delegation(
  p_user_id uuid,
  p_packet_id text,
  p_permit_id text,
  p_action_id text,
  p_action_fingerprint text,
  p_campaign_id uuid,
  p_consumed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.jhadina_growth_paid_campaigns;
  v_receipt public.jhadina_growth_approval_receipts;
  v_expected text;
  v_inserted text;
begin
  if p_consumed_at is null then
    raise exception 'GROWTH_WEEKLY_DELEGATION_CONSUMED_AT_REQUIRED';
  end if;

  if not exists (
    select 1
      from public.jhadina_social_weekly_packets p
      join public.jhadina_social_weekly_action_state a
        on a.user_id = p.user_id
       and a.packet_id = p.id
     where p.user_id = p_user_id
       and p.id = p_packet_id
       and p.status in ('approved','active')
       and p.approved_at is not null
       and p.approved_at <= p_consumed_at
       and p.week_ends_at > p_consumed_at
       and a.action_id = p_action_id
       and a.action_kind = 'paid_campaign'
       and a.permit_id = p_permit_id
       and a.action_fingerprint = p_action_fingerprint
       and a.status not in ('completed','cancelled')
  ) then
    return false;
  end if;

  select * into v_campaign
    from public.jhadina_growth_paid_campaigns
   where id = p_campaign_id
     and user_id = p_user_id
     and status = 'pending_approval';

  if v_campaign.id is null or v_campaign.approval_receipt_id is null then
    return false;
  end if;

  v_expected :=
    'growth-paid-publish:v1:' || v_campaign.id::text || ':' ||
    v_campaign.request_fingerprint;

  select * into v_receipt
    from public.jhadina_growth_approval_receipts
   where id = v_campaign.approval_receipt_id
     and user_id = p_user_id
     and campaign_id = v_campaign.id
     and action_id = v_campaign.action_id
     and type = 'paid-ad.publish'
     and fingerprint = v_expected
     and status in ('pending','approved')
     and expires_at > p_consumed_at;

  if v_receipt.id is null then
    return false;
  end if;

  insert into public.jhadina_social_weekly_permit_consumptions(
    user_id, permit_id, packet_id, action_id, action_fingerprint, consumed_at
  )
  values(
    p_user_id, p_permit_id, p_packet_id, p_action_id,
    p_action_fingerprint, p_consumed_at
  )
  on conflict (user_id, permit_id) do nothing
  returning permit_id into v_inserted;

  if v_inserted is null then
    return false;
  end if;

  update public.jhadina_growth_approval_receipts
     set status = 'consumed',
         approved_at = coalesce(approved_at, p_consumed_at),
         consumed_at = p_consumed_at
   where id = v_receipt.id
     and user_id = p_user_id
     and status in ('pending','approved')
     and expires_at > p_consumed_at;

  if not found then
    raise exception 'GROWTH_WEEKLY_CHILD_RECEIPT_CONSUME_FAILED';
  end if;

  update public.jhadina_growth_paid_campaigns
     set status = 'approved',
         updated_at = p_consumed_at
   where id = v_campaign.id
     and user_id = p_user_id
     and status = 'pending_approval';

  if not found then
    raise exception 'GROWTH_WEEKLY_CAMPAIGN_APPROVAL_STATE_FAILED';
  end if;

  return true;
end;
$$;

create or replace function public.jhadina_growth_weekly_enqueue_paid_campaign(
  p_user_id uuid,
  p_campaign_id uuid
)
returns public.jhadina_growth_paid_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.jhadina_growth_paid_campaigns;
  v_receipt public.jhadina_growth_approval_receipts;
  v_row public.jhadina_growth_paid_outbox;
  v_expected text;
begin
  select * into v_campaign
    from public.jhadina_growth_paid_campaigns
   where id = p_campaign_id
     and user_id = p_user_id;

  if v_campaign.id is null then
    raise exception 'GROWTH_WEEKLY_CAMPAIGN_NOT_FOUND';
  end if;
  if v_campaign.approval_receipt_id is null then
    raise exception 'GROWTH_WEEKLY_APPROVAL_REQUIRED';
  end if;

  select * into v_receipt
    from public.jhadina_growth_approval_receipts
   where id = v_campaign.approval_receipt_id
     and user_id = p_user_id
     and campaign_id = v_campaign.id;

  v_expected :=
    'growth-paid-publish:v1:' || v_campaign.id::text || ':' ||
    v_campaign.request_fingerprint;

  if v_receipt.id is null
     or v_receipt.status <> 'consumed'
     or v_receipt.type <> 'paid-ad.publish'
     or v_receipt.action_id <> v_campaign.action_id
     or v_receipt.fingerprint <> v_expected then
    raise exception 'GROWTH_WEEKLY_CONSUMED_CHILD_APPROVAL_REQUIRED';
  end if;

  insert into public.jhadina_growth_paid_outbox(
    user_id, campaign_id, approval_receipt_id, provider, channel,
    provider_account_id, operation_intent, payload, request_fingerprint,
    idempotency_key
  )
  values(
    p_user_id, v_campaign.id, v_receipt.id, v_campaign.provider,
    v_campaign.channel, v_campaign.provider_account_id,
    'create_paused_campaign',
    jsonb_build_object(
      'campaignId', v_campaign.id,
      'brandId', v_campaign.brand_id,
      'name', v_campaign.name,
      'objective', v_campaign.objective,
      'channel', v_campaign.channel,
      'provider', v_campaign.provider,
      'providerAccountId', v_campaign.provider_account_id,
      'audienceIds', v_campaign.audience_ids,
      'creativeIds', v_campaign.creative_ids,
      'landingPageId', v_campaign.landing_page_id,
      'currency', v_campaign.currency,
      'dailyBudgetMinor', v_campaign.daily_budget_minor,
      'lifetimeBudgetMinor', v_campaign.lifetime_budget_minor,
      'startsAt', v_campaign.starts_at,
      'endsAt', v_campaign.ends_at
    ),
    v_campaign.request_fingerprint,
    v_campaign.id::text || ':' || v_campaign.channel || ':' ||
    v_campaign.provider_account_id
  )
  on conflict (user_id, idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning * into v_row;

  update public.jhadina_growth_paid_campaigns
     set status = 'queued',
         updated_at = now()
   where id = v_campaign.id
     and user_id = p_user_id
     and status in ('approved','queued');

  return v_row;
end;
$$;

create or replace function public.jhadina_growth_weekly_begin_paid_outbox_attempt(
  p_user_id uuid,
  p_outbox_id uuid
)
returns public.jhadina_growth_paid_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.jhadina_growth_paid_outbox;
begin
  update public.jhadina_growth_paid_outbox
     set status = 'attempting',
         attempt_count = attempt_count + 1,
         last_error = null,
         updated_at = now()
   where id = p_outbox_id
     and user_id = p_user_id
     and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'GROWTH_WEEKLY_OUTBOX_NOT_ATTEMPTABLE';
  end if;

  update public.jhadina_growth_paid_campaigns
     set status = 'attempting',
         updated_at = now()
   where id = v_row.campaign_id
     and user_id = p_user_id;

  return v_row;
end;
$$;

create or replace function public.jhadina_growth_weekly_resolve_paid_outbox(
  p_user_id uuid,
  p_outbox_id uuid,
  p_status text,
  p_provider_operation_id text default null,
  p_provider_campaign_id text default null,
  p_error text default null
)
returns public.jhadina_growth_paid_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.jhadina_growth_paid_outbox;
begin
  if p_status not in ('delivered','failed','ambiguous') then
    raise exception 'GROWTH_WEEKLY_OUTBOX_STATUS_INVALID';
  end if;
  if p_status = 'delivered'
     and nullif(trim(p_provider_campaign_id), '') is null then
    raise exception 'GROWTH_WEEKLY_PROVIDER_CAMPAIGN_ID_REQUIRED';
  end if;

  update public.jhadina_growth_paid_outbox
     set status = p_status,
         provider_operation_id = coalesce(
           nullif(trim(p_provider_operation_id), ''),
           provider_operation_id
         ),
         provider_campaign_id = coalesce(
           nullif(trim(p_provider_campaign_id), ''),
           provider_campaign_id
         ),
         last_error = case
           when p_error is null then null
           else left(p_error, 1000)
         end,
         updated_at = now()
   where id = p_outbox_id
     and user_id = p_user_id
     and status = 'attempting'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'GROWTH_WEEKLY_OUTBOX_NOT_ATTEMPTING';
  end if;

  update public.jhadina_growth_paid_campaigns
     set status = p_status,
         provider_campaign_id = coalesce(
           nullif(trim(p_provider_campaign_id), ''),
           provider_campaign_id
         ),
         last_error = case
           when p_error is null then null
           else left(p_error, 1000)
         end,
         updated_at = now()
   where id = v_row.campaign_id
     and user_id = p_user_id;

  return v_row;
end;
$$;

revoke all on function public.jhadina_social_weekly_prepare_proposal(
  uuid,text,text,text,text,text,text,jsonb,timestamptz,uuid[],text,text,timestamptz
) from public, anon, authenticated;

revoke all on function public.jhadina_growth_weekly_prepare_paid_campaign(
  uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,text,text,
  bigint,bigint,timestamptz,timestamptz,text,text,timestamptz
) from public, anon, authenticated;

revoke all on function public.jhadina_social_consume_weekly_publication_delegation(
  uuid,text,text,text,text,uuid,timestamptz
) from public, anon, authenticated;
revoke all on function public.jhadina_social_weekly_enqueue_outbox(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_weekly_begin_outbox_attempt(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_weekly_complete_outbox(uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_weekly_fail_outbox(
  uuid,uuid,text,boolean,text
) from public, anon, authenticated;

revoke all on function public.jhadina_growth_consume_weekly_paid_delegation(
  uuid,text,text,text,text,uuid,timestamptz
) from public, anon, authenticated;
revoke all on function public.jhadina_growth_weekly_enqueue_paid_campaign(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_growth_weekly_begin_paid_outbox_attempt(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_growth_weekly_resolve_paid_outbox(
  uuid,uuid,text,text,text,text
) from public, anon, authenticated;

grant execute on function public.jhadina_social_weekly_prepare_proposal(
  uuid,text,text,text,text,text,text,jsonb,timestamptz,uuid[],text,text,timestamptz
) to service_role;

grant execute on function public.jhadina_growth_weekly_prepare_paid_campaign(
  uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,text,text,
  bigint,bigint,timestamptz,timestamptz,text,text,timestamptz
) to service_role;

grant execute on function public.jhadina_social_consume_weekly_publication_delegation(
  uuid,text,text,text,text,uuid,timestamptz
) to service_role;
grant execute on function public.jhadina_social_weekly_enqueue_outbox(uuid,uuid)
  to service_role;
grant execute on function public.jhadina_social_weekly_begin_outbox_attempt(uuid,uuid)
  to service_role;
grant execute on function public.jhadina_social_weekly_complete_outbox(uuid,uuid,text)
  to service_role;
grant execute on function public.jhadina_social_weekly_fail_outbox(
  uuid,uuid,text,boolean,text
) to service_role;

grant execute on function public.jhadina_growth_consume_weekly_paid_delegation(
  uuid,text,text,text,text,uuid,timestamptz
) to service_role;
grant execute on function public.jhadina_growth_weekly_enqueue_paid_campaign(uuid,uuid)
  to service_role;
grant execute on function public.jhadina_growth_weekly_begin_paid_outbox_attempt(uuid,uuid)
  to service_role;
grant execute on function public.jhadina_growth_weekly_resolve_paid_outbox(
  uuid,uuid,text,text,text,text
) to service_role;
