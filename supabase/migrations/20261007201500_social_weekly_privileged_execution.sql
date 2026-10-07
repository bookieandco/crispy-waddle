-- SOCIAL-JUGGERNAUT.24 — privileged weekly scheduler execution bridge.
-- Source-only until SWLC production storage/health is recovered.
--
-- These functions are service_role only. They preserve the existing Social/Growth
-- approval/outbox invariants while replacing auth.uid() with an explicit owner
-- bound to an approved weekly packet + exact child action permit.

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

  select *
    into v_proposal
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

  select *
    into v_receipt
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
     set status = 'queued', updated_at = now()
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
declare result public.jhadina_social_outbox;
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
declare result public.jhadina_social_outbox;
begin
  update public.jhadina_social_outbox
     set status = 'delivered',
         provider_post_id = p_provider_post_id,
         last_error = null,
         updated_at = now()
   where id = p_outbox_id
     and user_id = p_user_id
     and status <> 'cancelled'
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
declare result public.jhadina_social_outbox;
begin
  update public.jhadina_social_outbox
     set status = case when p_ambiguous then 'ambiguous' else 'failed' end,
         provider_post_id = coalesce(p_provider_post_id, provider_post_id),
         last_error = left(coalesce(p_error, 'provider failure'), 1000),
         updated_at = now()
   where id = p_outbox_id
     and user_id = p_user_id
     and status not in ('delivered','cancelled')
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

  select *
    into v_campaign
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

  select *
    into v_receipt
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
     set status = 'approved', updated_at = p_consumed_at
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
   where id = p_campaign_id and user_id = p_user_id;

  if v_campaign.id is null then
    raise exception 'GROWTH_WEEKLY_CAMPAIGN_NOT_FOUND';
  end if;
  if v_campaign.approval_receipt_id is null then
    raise exception 'GROWTH_WEEKLY_APPROVAL_REQUIRED';
  end if;

  select * into v_receipt
    from public.jhadina_growth_approval_receipts
   where id = v_campaign.approval_receipt_id
     and user_id = p_user_id;

  v_expected :=
    'growth-paid-publish:v1:' || v_campaign.id::text || ':' ||
    v_campaign.request_fingerprint;

  if v_receipt.status <> 'consumed'
     or v_receipt.type <> 'paid-ad.publish'
     or v_receipt.fingerprint <> v_expected then
    raise exception 'GROWTH_WEEKLY_CONSUMED_CHILD_APPROVAL_REQUIRED';
  end if;

  insert into public.jhadina_growth_paid_outbox(
    user_id,campaign_id,approval_receipt_id,provider,channel,provider_account_id,
    payload,request_fingerprint,idempotency_key
  ) values (
    p_user_id,v_campaign.id,v_receipt.id,v_campaign.provider,v_campaign.channel,
    v_campaign.provider_account_id,
    jsonb_build_object(
      'campaignId',v_campaign.id,
      'brandId',v_campaign.brand_id,
      'name',v_campaign.name,
      'objective',v_campaign.objective,
      'channel',v_campaign.channel,
      'providerAccountId',v_campaign.provider_account_id,
      'audienceIds',v_campaign.audience_ids,
      'creativeIds',v_campaign.creative_ids,
      'landingPageId',v_campaign.landing_page_id,
      'currency',v_campaign.currency,
      'dailyBudgetMinor',v_campaign.daily_budget_minor,
      'lifetimeBudgetMinor',v_campaign.lifetime_budget_minor,
      'startsAt',v_campaign.starts_at,
      'endsAt',v_campaign.ends_at
    ),
    v_campaign.request_fingerprint,
    v_campaign.id::text || ':' || v_campaign.channel || ':' ||
    v_campaign.provider_account_id
  )
  on conflict(user_id,idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning * into v_row;

  update public.jhadina_growth_paid_campaigns
     set status='queued',updated_at=now()
   where id=v_campaign.id
     and user_id=p_user_id
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
declare v_row public.jhadina_growth_paid_outbox;
begin
  update public.jhadina_growth_paid_outbox
     set status='attempting',
         attempt_count=attempt_count+1,
         last_error=null,
         updated_at=now()
   where id=p_outbox_id
     and user_id=p_user_id
     and status='pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'GROWTH_WEEKLY_OUTBOX_NOT_ATTEMPTABLE';
  end if;

  update public.jhadina_growth_paid_campaigns
     set status='attempting',updated_at=now()
   where id=v_row.campaign_id and user_id=p_user_id;

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
declare v_row public.jhadina_growth_paid_outbox;
begin
  if p_status not in ('delivered','failed','ambiguous') then
    raise exception 'GROWTH_WEEKLY_OUTBOX_STATUS_INVALID';
  end if;

  update public.jhadina_growth_paid_outbox
     set status=p_status,
         provider_operation_id=p_provider_operation_id,
         provider_campaign_id=p_provider_campaign_id,
         last_error=p_error,
         updated_at=now()
   where id=p_outbox_id
     and user_id=p_user_id
     and status='attempting'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'GROWTH_WEEKLY_OUTBOX_NOT_ATTEMPTING';
  end if;

  update public.jhadina_growth_paid_campaigns
     set status=p_status,
         provider_campaign_id=coalesce(
           p_provider_campaign_id, provider_campaign_id
         ),
         last_error=p_error,
         updated_at=now()
   where id=v_row.campaign_id and user_id=p_user_id;

  return v_row;
end;
$$;

revoke all on function public.jhadina_social_consume_weekly_publication_delegation(uuid,text,text,text,text,uuid,timestamptz)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_weekly_enqueue_outbox(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_weekly_begin_outbox_attempt(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_weekly_complete_outbox(uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.jhadina_social_weekly_fail_outbox(uuid,uuid,text,boolean,text)
  from public, anon, authenticated;
revoke all on function public.jhadina_growth_consume_weekly_paid_delegation(uuid,text,text,text,text,uuid,timestamptz)
  from public, anon, authenticated;
revoke all on function public.jhadina_growth_weekly_enqueue_paid_campaign(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_growth_weekly_begin_paid_outbox_attempt(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.jhadina_growth_weekly_resolve_paid_outbox(uuid,uuid,text,text,text,text)
  from public, anon, authenticated;

grant execute on function public.jhadina_social_consume_weekly_publication_delegation(uuid,text,text,text,text,uuid,timestamptz)
  to service_role;
grant execute on function public.jhadina_social_weekly_enqueue_outbox(uuid,uuid)
  to service_role;
grant execute on function public.jhadina_social_weekly_begin_outbox_attempt(uuid,uuid)
  to service_role;
grant execute on function public.jhadina_social_weekly_complete_outbox(uuid,uuid,text)
  to service_role;
grant execute on function public.jhadina_social_weekly_fail_outbox(uuid,uuid,text,boolean,text)
  to service_role;
grant execute on function public.jhadina_growth_consume_weekly_paid_delegation(uuid,text,text,text,text,uuid,timestamptz)
  to service_role;
grant execute on function public.jhadina_growth_weekly_enqueue_paid_campaign(uuid,uuid)
  to service_role;
grant execute on function public.jhadina_growth_weekly_begin_paid_outbox_attempt(uuid,uuid)
  to service_role;
grant execute on function public.jhadina_growth_weekly_resolve_paid_outbox(uuid,uuid,text,text,text,text)
  to service_role;
