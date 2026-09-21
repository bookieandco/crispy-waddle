-- SOCIAL.3-SOCIAL.10: governed social account bindings, explicit publication
-- proposals, single-use approval receipts, durable per-target outbox, and
-- append-only observation receipts.
--
-- External provider credentials never live in these tables. Provider profile
-- identifiers are bindings only; credentials remain server-side.

create table if not exists public.jhadina_social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null,
  provider text not null,
  provider_profile_id text not null,
  platform text not null,
  display_name text not null,
  handle text,
  status text not null default 'connected'
    check (status in ('connected', 'disabled', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_profile_id)
);

create table if not exists public.jhadina_social_approval_receipts (
  id uuid primary key default gen_random_uuid(),
  action_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  fingerprint text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'consumed', 'expired')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, action_id)
);

create table if not exists public.jhadina_social_publication_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  brand text not null,
  text text not null,
  media_urls jsonb not null default '[]'::jsonb
    check (jsonb_typeof(media_urls) = 'array'),
  scheduled_at timestamptz,
  status text not null default 'pending_approval'
    check (status in (
      'pending_approval', 'approved', 'queued', 'partially_delivered',
      'delivered', 'failed', 'cancelled'
    )),
  request_fingerprint text not null,
  idempotency_key text not null,
  approval_receipt_id uuid references public.jhadina_social_approval_receipts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, action_id),
  unique (user_id, idempotency_key)
);

create table if not exists public.jhadina_social_publication_targets (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.jhadina_social_publication_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.jhadina_social_accounts(id),
  brand text not null,
  provider text not null,
  provider_profile_id text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  unique (proposal_id, account_id),
  unique (proposal_id, provider, provider_profile_id)
);

create table if not exists public.jhadina_social_outbox (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.jhadina_social_publication_proposals(id) on delete cascade,
  target_id uuid not null references public.jhadina_social_publication_targets(id) on delete cascade,
  account_id uuid not null references public.jhadina_social_accounts(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  brand text not null,
  provider text not null,
  provider_profile_id text not null,
  platform text not null,
  text text not null,
  media_urls jsonb not null default '[]'::jsonb
    check (jsonb_typeof(media_urls) = 'array'),
  scheduled_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'attempting', 'delivered', 'failed', 'ambiguous', 'cancelled')),
  idempotency_key text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_post_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (proposal_id, target_id)
);

create table if not exists public.jhadina_social_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid references public.jhadina_social_publication_proposals(id) on delete set null,
  outbox_id uuid references public.jhadina_social_outbox(id) on delete set null,
  kind text not null,
  source text not null,
  provider text,
  platform text not null,
  account_id uuid references public.jhadina_social_accounts(id) on delete set null,
  provider_profile_id text,
  content_id text,
  observed_at timestamptz not null,
  source_url text,
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists jhadina_social_accounts_owner_idx
  on public.jhadina_social_accounts (user_id, brand, status);
create index if not exists jhadina_social_proposals_owner_idx
  on public.jhadina_social_publication_proposals (user_id, status, created_at desc);
create index if not exists jhadina_social_targets_proposal_idx
  on public.jhadina_social_publication_targets (proposal_id);
create index if not exists jhadina_social_outbox_dispatch_idx
  on public.jhadina_social_outbox (user_id, proposal_id, status, updated_at);
create index if not exists jhadina_social_observations_owner_idx
  on public.jhadina_social_observations (user_id, observed_at desc);

alter table public.jhadina_social_accounts enable row level security;
alter table public.jhadina_social_approval_receipts enable row level security;
alter table public.jhadina_social_publication_proposals enable row level security;
alter table public.jhadina_social_publication_targets enable row level security;
alter table public.jhadina_social_outbox enable row level security;
alter table public.jhadina_social_observations enable row level security;

create policy "social accounts owner readable"
  on public.jhadina_social_accounts for select using (auth.uid() = user_id);
create policy "social approval receipts owner readable"
  on public.jhadina_social_approval_receipts for select using (auth.uid() = user_id);
create policy "social proposals owner readable"
  on public.jhadina_social_publication_proposals for select using (auth.uid() = user_id);
create policy "social targets owner readable"
  on public.jhadina_social_publication_targets for select using (auth.uid() = user_id);
create policy "social outbox owner readable"
  on public.jhadina_social_outbox for select using (auth.uid() = user_id);
create policy "social observations owner readable"
  on public.jhadina_social_observations for select using (auth.uid() = user_id);

revoke all on public.jhadina_social_accounts from anon;
revoke all on public.jhadina_social_approval_receipts from anon;
revoke all on public.jhadina_social_publication_proposals from anon;
revoke all on public.jhadina_social_publication_targets from anon;
revoke all on public.jhadina_social_outbox from anon;
revoke all on public.jhadina_social_observations from anon;

grant select on public.jhadina_social_accounts to authenticated;
grant select on public.jhadina_social_approval_receipts to authenticated;
grant select on public.jhadina_social_publication_proposals to authenticated;
grant select on public.jhadina_social_publication_targets to authenticated;
grant select on public.jhadina_social_outbox to authenticated;
grant select on public.jhadina_social_observations to authenticated;

create or replace function public.jhadina_social_upsert_account(
  p_brand text,
  p_provider text,
  p_provider_profile_id text,
  p_platform text,
  p_display_name text,
  p_handle text default null
)
returns public.jhadina_social_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.jhadina_social_accounts;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_brand), '') is null or nullif(trim(p_provider_profile_id), '') is null then
    raise exception 'brand and provider profile are required';
  end if;

  insert into public.jhadina_social_accounts (
    user_id, brand, provider, provider_profile_id, platform, display_name, handle, status
  ) values (
    auth.uid(), p_brand, p_provider, p_provider_profile_id, p_platform,
    coalesce(nullif(trim(p_display_name), ''), p_provider_profile_id), p_handle, 'connected'
  )
  on conflict (user_id, provider, provider_profile_id)
  do update set
    brand = excluded.brand,
    platform = excluded.platform,
    display_name = excluded.display_name,
    handle = excluded.handle,
    status = 'connected',
    updated_at = now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.jhadina_social_create_proposal(
  p_action_id text,
  p_brand text,
  p_text text,
  p_media_urls jsonb,
  p_scheduled_at timestamptz,
  p_target_account_ids uuid[],
  p_request_fingerprint text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.jhadina_social_publication_proposals;
  proposal_id uuid;
  requested_count integer;
  eligible_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_text), '') is null then raise exception 'social text required'; end if;
  if p_target_account_ids is null or cardinality(p_target_account_ids) = 0 then
    raise exception 'explicit social targets required';
  end if;

  requested_count := cardinality(p_target_account_ids);
  if requested_count <> (select count(distinct value) from unnest(p_target_account_ids) as value) then
    raise exception 'duplicate social target account';
  end if;

  select * into existing
    from public.jhadina_social_publication_proposals
   where user_id = auth.uid() and idempotency_key = p_idempotency_key;

  if existing.id is not null then
    if existing.request_fingerprint <> p_request_fingerprint then
      raise exception 'SOCIAL_IDEMPOTENCY_CONFLICT';
    end if;
    return existing.id;
  end if;

  select count(*) into eligible_count
    from public.jhadina_social_accounts
   where user_id = auth.uid()
     and id = any(p_target_account_ids)
     and brand = p_brand
     and status = 'connected';

  if eligible_count <> requested_count then
    raise exception 'SOCIAL_TARGET_OWNERSHIP_OR_BRAND_MISMATCH';
  end if;

  insert into public.jhadina_social_publication_proposals (
    user_id, action_id, brand, text, media_urls, scheduled_at,
    request_fingerprint, idempotency_key
  ) values (
    auth.uid(), p_action_id, p_brand, trim(p_text), coalesce(p_media_urls, '[]'::jsonb),
    p_scheduled_at, p_request_fingerprint, p_idempotency_key
  )
  returning id into proposal_id;

  insert into public.jhadina_social_publication_targets (
    proposal_id, user_id, account_id, brand, provider, provider_profile_id, platform
  )
  select proposal_id, auth.uid(), account.id, account.brand, account.provider,
         account.provider_profile_id, account.platform
    from public.jhadina_social_accounts account
   where account.user_id = auth.uid()
     and account.id = any(p_target_account_ids)
     and account.brand = p_brand
     and account.status = 'connected';

  return proposal_id;
end;
$$;

create or replace function public.jhadina_social_create_approval_receipt(
  p_action_id text,
  p_type text,
  p_fingerprint text,
  p_expires_at timestamptz
)
returns public.jhadina_social_approval_receipts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.jhadina_social_approval_receipts;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.jhadina_social_approval_receipts (
    action_id, user_id, type, fingerprint, expires_at
  ) values (
    p_action_id, auth.uid(), p_type, p_fingerprint, p_expires_at
  )
  returning * into result;
  return result;
end;
$$;

create or replace function public.jhadina_social_attach_approval_receipt(
  p_proposal_id uuid,
  p_receipt_id uuid
)
returns public.jhadina_social_publication_proposals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.jhadina_social_publication_proposals;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.jhadina_social_publication_proposals proposal
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
          and receipt.fingerprint is not null
     )
  returning * into result;
  if result.id is null then raise exception 'approval receipt cannot be attached'; end if;
  return result;
end;
$$;

create or replace function public.jhadina_social_approve_receipt(p_receipt_id uuid)
returns public.jhadina_social_approval_receipts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.jhadina_social_approval_receipts;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.jhadina_social_approval_receipts
     set status = 'approved', approved_at = now()
   where id = p_receipt_id
     and user_id = auth.uid()
     and status = 'pending'
     and expires_at > now()
  returning * into result;
  if result.id is null then raise exception 'approval receipt cannot be approved'; end if;
  return result;
end;
$$;

create or replace function public.jhadina_social_consume_approval_receipt(
  p_receipt_id uuid,
  p_action_id text,
  p_type text,
  p_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare consumed boolean;
begin
  if auth.uid() is null then return false; end if;
  update public.jhadina_social_approval_receipts
     set status = 'consumed', consumed_at = now()
   where id = p_receipt_id
     and user_id = auth.uid()
     and action_id = p_action_id
     and type = p_type
     and fingerprint = p_fingerprint
     and status = 'approved'
     and expires_at > now()
  returning true into consumed;

  if consumed is null then
    update public.jhadina_social_approval_receipts
       set status = 'expired'
     where id = p_receipt_id
       and user_id = auth.uid()
       and status = 'approved'
       and expires_at <= now();
    return false;
  end if;
  return consumed;
end;
$$;

create or replace function public.jhadina_social_refresh_proposal_status(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  total_count integer;
  delivered_count integer;
  terminal_failure_count integer;
begin
  select count(*),
         count(*) filter (where status = 'delivered'),
         count(*) filter (where status in ('failed', 'ambiguous', 'cancelled'))
    into total_count, delivered_count, terminal_failure_count
    from public.jhadina_social_outbox
   where proposal_id = p_proposal_id;

  update public.jhadina_social_publication_proposals
     set status = case
       when total_count > 0 and delivered_count = total_count then 'delivered'
       when delivered_count > 0 then 'partially_delivered'
       when total_count > 0 and terminal_failure_count = total_count then 'failed'
       else 'queued'
     end,
     updated_at = now()
   where id = p_proposal_id;
end;
$$;

create or replace function public.jhadina_social_enqueue_outbox(p_proposal_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare inserted_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1
      from public.jhadina_social_publication_proposals proposal
      join public.jhadina_social_approval_receipts receipt
        on receipt.id = proposal.approval_receipt_id
       and receipt.user_id = proposal.user_id
       and receipt.action_id = proposal.action_id
     where proposal.id = p_proposal_id
       and proposal.user_id = auth.uid()
       and proposal.status = 'pending_approval'
       and receipt.type = 'public.publish'
       and receipt.status = 'consumed'
       and receipt.fingerprint =
         'social-public-publish:v1:' || proposal.id::text || ':' || proposal.request_fingerprint
  ) then
    raise exception 'social proposal cannot be enqueued without a consumed matching approval';
  end if;

  insert into public.jhadina_social_outbox (
    proposal_id, target_id, account_id, user_id, action_id, brand, provider,
    provider_profile_id, platform, text, media_urls, scheduled_at,
    idempotency_key
  )
  select proposal.id, target.id, target.account_id, proposal.user_id, proposal.action_id,
         target.brand, target.provider, target.provider_profile_id, target.platform,
         proposal.text, proposal.media_urls, proposal.scheduled_at,
         proposal.id::text || ':' || target.account_id::text
    from public.jhadina_social_publication_proposals proposal
    join public.jhadina_social_publication_targets target on target.proposal_id = proposal.id
   where proposal.id = p_proposal_id
     and proposal.user_id = auth.uid()
  on conflict (user_id, idempotency_key) do nothing;

  get diagnostics inserted_count = row_count;
  update public.jhadina_social_publication_proposals
     set status = 'queued', updated_at = now()
   where id = p_proposal_id and user_id = auth.uid();
  return inserted_count;
end;
$$;

create or replace function public.jhadina_social_begin_outbox_attempt(p_outbox_id uuid)
returns public.jhadina_social_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.jhadina_social_outbox;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.jhadina_social_outbox
     set status = 'attempting', attempt_count = attempt_count + 1,
         last_error = null, updated_at = now()
   where id = p_outbox_id
     and user_id = auth.uid()
     and status in ('pending', 'failed')
  returning * into result;
  if result.id is null then raise exception 'social outbox job cannot be attempted'; end if;
  return result;
end;
$$;

create or replace function public.jhadina_social_complete_outbox(
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
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.jhadina_social_outbox
     set status = 'delivered', provider_post_id = p_provider_post_id,
         last_error = null, updated_at = now()
   where id = p_outbox_id
     and user_id = auth.uid()
     and status <> 'cancelled'
  returning * into result;
  if result.id is null then raise exception 'social outbox job cannot be completed'; end if;
  perform public.jhadina_social_refresh_proposal_status(result.proposal_id);
  return result;
end;
$$;

create or replace function public.jhadina_social_fail_outbox(
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
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.jhadina_social_outbox
     set status = case when p_ambiguous then 'ambiguous' else 'failed' end,
         provider_post_id = coalesce(p_provider_post_id, provider_post_id),
         last_error = left(coalesce(p_error, 'provider failure'), 1000),
         updated_at = now()
   where id = p_outbox_id
     and user_id = auth.uid()
     and status not in ('delivered', 'cancelled')
  returning * into result;
  if result.id is null then raise exception 'social outbox job cannot be failed'; end if;
  perform public.jhadina_social_refresh_proposal_status(result.proposal_id);
  return result;
end;
$$;

create or replace function public.jhadina_social_record_observation(
  p_proposal_id uuid,
  p_outbox_id uuid,
  p_kind text,
  p_source text,
  p_provider text,
  p_platform text,
  p_account_id uuid,
  p_provider_profile_id text,
  p_content_id text,
  p_observed_at timestamptz,
  p_source_url text,
  p_evidence jsonb,
  p_metrics jsonb,
  p_attributes jsonb
)
returns public.jhadina_social_observations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.jhadina_social_observations;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_proposal_id is not null and not exists (
    select 1 from public.jhadina_social_publication_proposals
     where id = p_proposal_id and user_id = auth.uid()
  ) then raise exception 'social proposal ownership mismatch'; end if;
  if p_account_id is not null and not exists (
    select 1 from public.jhadina_social_accounts
     where id = p_account_id and user_id = auth.uid()
  ) then raise exception 'social account ownership mismatch'; end if;

  insert into public.jhadina_social_observations (
    user_id, proposal_id, outbox_id, kind, source, provider, platform,
    account_id, provider_profile_id, content_id, observed_at, source_url,
    evidence, metrics, attributes
  ) values (
    auth.uid(), p_proposal_id, p_outbox_id, p_kind, p_source, p_provider, p_platform,
    p_account_id, p_provider_profile_id, p_content_id, p_observed_at, p_source_url,
    coalesce(p_evidence, '[]'::jsonb), coalesce(p_metrics, '{}'::jsonb),
    coalesce(p_attributes, '{}'::jsonb)
  )
  returning * into result;
  return result;
end;
$$;

revoke all on function public.jhadina_social_upsert_account(text,text,text,text,text,text) from public, anon;
revoke all on function public.jhadina_social_create_proposal(text,text,text,jsonb,timestamptz,uuid[],text,text) from public, anon;
revoke all on function public.jhadina_social_create_approval_receipt(text,text,text,timestamptz) from public, anon;
revoke all on function public.jhadina_social_attach_approval_receipt(uuid,uuid) from public, anon;
revoke all on function public.jhadina_social_approve_receipt(uuid) from public, anon;
revoke all on function public.jhadina_social_consume_approval_receipt(uuid,text,text,text) from public, anon;
revoke all on function public.jhadina_social_refresh_proposal_status(uuid) from public, anon, authenticated;
revoke all on function public.jhadina_social_enqueue_outbox(uuid) from public, anon;
revoke all on function public.jhadina_social_begin_outbox_attempt(uuid) from public, anon;
revoke all on function public.jhadina_social_complete_outbox(uuid,text) from public, anon;
revoke all on function public.jhadina_social_fail_outbox(uuid,text,boolean,text) from public, anon;
revoke all on function public.jhadina_social_record_observation(uuid,uuid,text,text,text,text,uuid,text,text,timestamptz,text,jsonb,jsonb,jsonb) from public, anon;

grant execute on function public.jhadina_social_upsert_account(text,text,text,text,text,text) to authenticated;
grant execute on function public.jhadina_social_create_proposal(text,text,text,jsonb,timestamptz,uuid[],text,text) to authenticated;
grant execute on function public.jhadina_social_create_approval_receipt(text,text,text,timestamptz) to authenticated;
grant execute on function public.jhadina_social_attach_approval_receipt(uuid,uuid) to authenticated;
grant execute on function public.jhadina_social_approve_receipt(uuid) to authenticated;
grant execute on function public.jhadina_social_consume_approval_receipt(uuid,text,text,text) to authenticated;
grant execute on function public.jhadina_social_enqueue_outbox(uuid) to authenticated;
grant execute on function public.jhadina_social_begin_outbox_attempt(uuid) to authenticated;
grant execute on function public.jhadina_social_complete_outbox(uuid,text) to authenticated;
grant execute on function public.jhadina_social_fail_outbox(uuid,text,boolean,text) to authenticated;
grant execute on function public.jhadina_social_record_observation(uuid,uuid,text,text,text,text,uuid,text,text,timestamptz,text,jsonb,jsonb,jsonb) to authenticated;
