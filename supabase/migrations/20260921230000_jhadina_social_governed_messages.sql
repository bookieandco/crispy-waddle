-- SH-TTS.6: governed one-recipient social messaging.
-- Reuses jhadina_social_approval_receipts and the canonical Action Core receipt flow.
-- Provider credentials remain server-side and are never stored here.

create table if not exists public.jhadina_social_contact_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_ref text not null,
  provider text not null,
  platform text not null,
  provider_recipient_id text not null,
  state text not null
    check (state in ('eligible','unknown','declined','stop_contact','suppressed')),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_recipient_id)
);

create table if not exists public.jhadina_social_message_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  brand text not null,
  sender_account_id uuid not null references public.jhadina_social_accounts(id),
  provider text not null,
  provider_profile_id text not null,
  platform text not null,
  recipient_ref text not null,
  provider_recipient_id text not null,
  conversation_ref text,
  text text not null,
  offer_ref text,
  outreach_plan_ref text,
  touch_id text,
  brand_voice_profile_ref text not null,
  channel_voice_profile_ref text not null,
  eligibility_evidence jsonb not null check (jsonb_typeof(eligibility_evidence) = 'array'),
  eligibility_observed_at timestamptz not null,
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','queued','delivered','failed','ambiguous','cancelled')),
  request_fingerprint text not null,
  idempotency_key text not null,
  approval_receipt_id uuid references public.jhadina_social_approval_receipts(id),
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, action_id),
  unique (user_id, idempotency_key)
);

create unique index if not exists jhadina_social_message_touch_unique_idx
  on public.jhadina_social_message_proposals (user_id, touch_id)
  where touch_id is not null;

create table if not exists public.jhadina_social_message_outbox (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.jhadina_social_message_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  sender_account_id uuid not null references public.jhadina_social_accounts(id),
  provider text not null,
  provider_profile_id text not null,
  platform text not null,
  provider_recipient_id text not null,
  conversation_ref text,
  text text not null,
  status text not null default 'pending'
    check (status in ('pending','attempting','delivered','failed','ambiguous','cancelled')),
  idempotency_key text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id),
  unique (user_id, idempotency_key)
);

create index if not exists jhadina_social_contact_states_owner_idx
  on public.jhadina_social_contact_states (user_id, provider, platform, state, observed_at desc);
create index if not exists jhadina_social_message_proposals_owner_idx
  on public.jhadina_social_message_proposals (user_id, status, created_at desc);
create index if not exists jhadina_social_message_outbox_dispatch_idx
  on public.jhadina_social_message_outbox (user_id, status, updated_at);

alter table public.jhadina_social_contact_states enable row level security;
alter table public.jhadina_social_message_proposals enable row level security;
alter table public.jhadina_social_message_outbox enable row level security;

create policy "social contact states owner readable"
  on public.jhadina_social_contact_states for select using (auth.uid() = user_id);
create policy "social message proposals owner readable"
  on public.jhadina_social_message_proposals for select using (auth.uid() = user_id);
create policy "social message outbox owner readable"
  on public.jhadina_social_message_outbox for select using (auth.uid() = user_id);

revoke all on public.jhadina_social_contact_states from anon;
revoke all on public.jhadina_social_message_proposals from anon;
revoke all on public.jhadina_social_message_outbox from anon;

grant select on public.jhadina_social_contact_states to authenticated;
grant select on public.jhadina_social_message_proposals to authenticated;
grant select on public.jhadina_social_message_outbox to authenticated;

create or replace function public.jhadina_social_upsert_contact_state(
  p_recipient_ref text,
  p_provider text,
  p_platform text,
  p_provider_recipient_id text,
  p_state text,
  p_evidence jsonb,
  p_observed_at timestamptz
)
returns public.jhadina_social_contact_states
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.jhadina_social_contact_states;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_recipient_ref), '') is null
     or nullif(trim(p_provider), '') is null
     or nullif(trim(p_provider_recipient_id), '') is null then
    raise exception 'social contact identity required';
  end if;
  if p_state not in ('eligible','unknown','declined','stop_contact','suppressed') then
    raise exception 'invalid social contact state';
  end if;
  if jsonb_typeof(coalesce(p_evidence, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)) = 0 then
    raise exception 'social contact state requires evidence';
  end if;
  if p_observed_at > now() then raise exception 'social contact observation cannot be in the future'; end if;

  insert into public.jhadina_social_contact_states (
    user_id, recipient_ref, provider, platform, provider_recipient_id,
    state, evidence, observed_at
  ) values (
    auth.uid(), trim(p_recipient_ref), trim(p_provider), trim(p_platform),
    trim(p_provider_recipient_id), p_state, p_evidence, p_observed_at
  )
  on conflict (user_id, provider, provider_recipient_id)
  do update set
    recipient_ref = excluded.recipient_ref,
    platform = excluded.platform,
    state = excluded.state,
    evidence = excluded.evidence,
    observed_at = excluded.observed_at,
    updated_at = now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.jhadina_social_create_message_proposal(
  p_action_id text,
  p_brand text,
  p_sender_account_id uuid,
  p_recipient_ref text,
  p_provider_recipient_id text,
  p_conversation_ref text,
  p_text text,
  p_offer_ref text,
  p_outreach_plan_ref text,
  p_touch_id text,
  p_brand_voice_profile_ref text,
  p_channel_voice_profile_ref text,
  p_eligibility_evidence jsonb,
  p_eligibility_observed_at timestamptz,
  p_request_fingerprint text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sender public.jhadina_social_accounts;
  contact public.jhadina_social_contact_states;
  existing public.jhadina_social_message_proposals;
  result_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_text), '') is null then raise exception 'social message text required'; end if;
  if nullif(trim(p_recipient_ref), '') is null or nullif(trim(p_provider_recipient_id), '') is null then
    raise exception 'social message recipient required';
  end if;
  if nullif(trim(p_brand_voice_profile_ref), '') is null
     or nullif(trim(p_channel_voice_profile_ref), '') is null then
    raise exception 'social message voice profile required';
  end if;
  if jsonb_typeof(coalesce(p_eligibility_evidence, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_eligibility_evidence, '[]'::jsonb)) = 0 then
    raise exception 'social message eligibility evidence required';
  end if;

  select * into sender
    from public.jhadina_social_accounts
   where id = p_sender_account_id
     and user_id = auth.uid()
     and brand = p_brand
     and status = 'connected';
  if sender.id is null then raise exception 'SOCIAL_MESSAGE_SENDER_OWNERSHIP_OR_BRAND_MISMATCH'; end if;

  select * into contact
    from public.jhadina_social_contact_states
   where user_id = auth.uid()
     and provider = sender.provider
     and platform = sender.platform
     and provider_recipient_id = p_provider_recipient_id
     and recipient_ref = p_recipient_ref;
  if contact.id is null
     or contact.state <> 'eligible'
     or contact.observed_at <> p_eligibility_observed_at
     or not (contact.evidence @> p_eligibility_evidence) then
    raise exception 'SOCIAL_MESSAGE_ELIGIBILITY_MISMATCH';
  end if;

  select * into existing
    from public.jhadina_social_message_proposals
   where user_id = auth.uid() and idempotency_key = p_idempotency_key;
  if existing.id is not null then
    if existing.request_fingerprint <> p_request_fingerprint then
      raise exception 'SOCIAL_MESSAGE_IDEMPOTENCY_CONFLICT';
    end if;
    return existing.id;
  end if;

  insert into public.jhadina_social_message_proposals (
    user_id, action_id, brand, sender_account_id, provider, provider_profile_id,
    platform, recipient_ref, provider_recipient_id, conversation_ref, text,
    offer_ref, outreach_plan_ref, touch_id, brand_voice_profile_ref,
    channel_voice_profile_ref, eligibility_evidence, eligibility_observed_at,
    request_fingerprint, idempotency_key
  ) values (
    auth.uid(), p_action_id, p_brand, sender.id, sender.provider, sender.provider_profile_id,
    sender.platform, trim(p_recipient_ref), trim(p_provider_recipient_id), p_conversation_ref,
    trim(p_text), p_offer_ref, p_outreach_plan_ref, p_touch_id,
    p_brand_voice_profile_ref, p_channel_voice_profile_ref,
    p_eligibility_evidence, p_eligibility_observed_at,
    p_request_fingerprint, p_idempotency_key
  )
  returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.jhadina_social_attach_message_approval(
  p_proposal_id uuid,
  p_receipt_id uuid
)
returns public.jhadina_social_message_proposals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.jhadina_social_message_proposals;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.jhadina_social_message_proposals proposal
     set approval_receipt_id = p_receipt_id, updated_at = now()
   where proposal.id = p_proposal_id
     and proposal.user_id = auth.uid()
     and proposal.status = 'pending_approval'
     and (proposal.approval_receipt_id is null or proposal.approval_receipt_id = p_receipt_id)
     and exists (
       select 1 from public.jhadina_social_approval_receipts receipt
        where receipt.id = p_receipt_id
          and receipt.user_id = auth.uid()
          and receipt.action_id = proposal.action_id
     )
  returning * into result;
  if result.id is null then raise exception 'social message approval cannot be attached'; end if;
  return result;
end;
$$;

create or replace function public.jhadina_social_enqueue_message_outbox(p_proposal_id uuid)
returns public.jhadina_social_message_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.jhadina_social_message_outbox;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  if not exists (
    select 1
      from public.jhadina_social_message_proposals proposal
      join public.jhadina_social_approval_receipts receipt
        on receipt.id = proposal.approval_receipt_id
       and receipt.user_id = proposal.user_id
       and receipt.action_id = proposal.action_id
     where proposal.id = p_proposal_id
       and proposal.user_id = auth.uid()
       and proposal.status = 'pending_approval'
       and receipt.type = 'social.message.send'
       and receipt.status = 'consumed'
       and receipt.fingerprint =
         'social-direct-message:v1:' || proposal.id::text || ':' || proposal.request_fingerprint
  ) then
    raise exception 'social message cannot be enqueued without consumed matching approval';
  end if;

  if not exists (
    select 1
      from public.jhadina_social_message_proposals proposal
      join public.jhadina_social_contact_states contact
        on contact.user_id = proposal.user_id
       and contact.provider = proposal.provider
       and contact.platform = proposal.platform
       and contact.recipient_ref = proposal.recipient_ref
       and contact.provider_recipient_id = proposal.provider_recipient_id
     where proposal.id = p_proposal_id
       and proposal.user_id = auth.uid()
       and contact.state = 'eligible'
       and contact.observed_at >= proposal.eligibility_observed_at
       and contact.observed_at > now() - interval '24 hours'
  ) then
    raise exception 'SOCIAL_MESSAGE_FRESH_ELIGIBILITY_REQUIRED';
  end if;

  insert into public.jhadina_social_message_outbox (
    proposal_id, user_id, action_id, sender_account_id, provider,
    provider_profile_id, platform, provider_recipient_id, conversation_ref,
    text, idempotency_key
  )
  select proposal.id, proposal.user_id, proposal.action_id, proposal.sender_account_id,
         proposal.provider, proposal.provider_profile_id, proposal.platform,
         proposal.provider_recipient_id, proposal.conversation_ref, proposal.text,
         proposal.id::text || ':' || proposal.provider_recipient_id
    from public.jhadina_social_message_proposals proposal
   where proposal.id = p_proposal_id and proposal.user_id = auth.uid()
  on conflict (proposal_id) do update
    set updated_at = public.jhadina_social_message_outbox.updated_at
  returning * into result;

  update public.jhadina_social_message_proposals
     set status = 'queued', updated_at = now()
   where id = p_proposal_id and user_id = auth.uid();

  return result;
end;
$$;

create or replace function public.jhadina_social_begin_message_attempt(p_outbox_id uuid)
returns public.jhadina_social_message_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.jhadina_social_message_outbox;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.jhadina_social_message_outbox
     set status = 'attempting', attempt_count = attempt_count + 1,
         last_error = null, updated_at = now()
   where id = p_outbox_id
     and user_id = auth.uid()
     and status in ('pending','failed')
  returning * into result;
  if result.id is null then raise exception 'social message outbox cannot be attempted'; end if;
  return result;
end;
$$;

create or replace function public.jhadina_social_complete_message_outbox(
  p_outbox_id uuid,
  p_provider_message_id text
)
returns public.jhadina_social_message_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.jhadina_social_message_outbox;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.jhadina_social_message_outbox
     set status = 'delivered', provider_message_id = p_provider_message_id,
         last_error = null, updated_at = now()
   where id = p_outbox_id and user_id = auth.uid() and status <> 'cancelled'
  returning * into result;
  if result.id is null then raise exception 'social message outbox cannot be completed'; end if;

  update public.jhadina_social_message_proposals
     set status = 'delivered', provider_message_id = p_provider_message_id,
         last_error = null, updated_at = now()
   where id = result.proposal_id and user_id = auth.uid();

  return result;
end;
$$;

create or replace function public.jhadina_social_fail_message_outbox(
  p_outbox_id uuid,
  p_error text,
  p_ambiguous boolean default false,
  p_provider_message_id text default null
)
returns public.jhadina_social_message_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.jhadina_social_message_outbox;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.jhadina_social_message_outbox
     set status = case when p_ambiguous then 'ambiguous' else 'failed' end,
         provider_message_id = coalesce(p_provider_message_id, provider_message_id),
         last_error = left(coalesce(p_error, 'provider failure'), 1000),
         updated_at = now()
   where id = p_outbox_id and user_id = auth.uid()
     and status not in ('delivered','cancelled')
  returning * into result;
  if result.id is null then raise exception 'social message outbox cannot be failed'; end if;

  update public.jhadina_social_message_proposals
     set status = case when p_ambiguous then 'ambiguous' else 'failed' end,
         provider_message_id = coalesce(p_provider_message_id, provider_message_id),
         last_error = left(coalesce(p_error, 'provider failure'), 1000),
         updated_at = now()
   where id = result.proposal_id and user_id = auth.uid();

  return result;
end;
$$;

revoke all on function public.jhadina_social_upsert_contact_state(text,text,text,text,text,jsonb,timestamptz) from public, anon;
revoke all on function public.jhadina_social_create_message_proposal(text,text,uuid,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,text,text) from public, anon;
revoke all on function public.jhadina_social_attach_message_approval(uuid,uuid) from public, anon;
revoke all on function public.jhadina_social_enqueue_message_outbox(uuid) from public, anon;
revoke all on function public.jhadina_social_begin_message_attempt(uuid) from public, anon;
revoke all on function public.jhadina_social_complete_message_outbox(uuid,text) from public, anon;
revoke all on function public.jhadina_social_fail_message_outbox(uuid,text,boolean,text) from public, anon;

grant execute on function public.jhadina_social_upsert_contact_state(text,text,text,text,text,jsonb,timestamptz) to authenticated;
grant execute on function public.jhadina_social_create_message_proposal(text,text,uuid,text,text,text,text,text,text,text,text,text,jsonb,timestamptz,text,text) to authenticated;
grant execute on function public.jhadina_social_attach_message_approval(uuid,uuid) to authenticated;
grant execute on function public.jhadina_social_enqueue_message_outbox(uuid) to authenticated;
grant execute on function public.jhadina_social_begin_message_attempt(uuid) to authenticated;
grant execute on function public.jhadina_social_complete_message_outbox(uuid,text) to authenticated;
grant execute on function public.jhadina_social_fail_message_outbox(uuid,text,boolean,text) to authenticated;
