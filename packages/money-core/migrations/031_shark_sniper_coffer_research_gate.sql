-- SHARK-SNIPER.LIVE-COMMISSION.46: STAGED SOURCE ONLY
-- DO NOT APPLY TO PRODUCTION OR EXPOSE THE FUNCTION VIA POSTGREST.
-- This is a RESEARCH admission companion to canonical Money execution permits,
-- not a signing, execution or budget-spending authorization.
begin;

create table if not exists public.money_sniper_coffer_research_policy (
  wallet_connection_id text primary key,
  user_id text not null,
  provider text not null check (provider = 'jupiter-ultra'),
  currency text not null,
  policy_hash text not null check (length(policy_hash) between 16 and 256),
  max_order_minor bigint not null check (max_order_minor > 0),
  max_daily_minor bigint not null check (max_daily_minor > 0),
  max_loss_minor bigint not null check (max_loss_minor > 0),
  max_order_count integer not null check (max_order_count between 1 and 1000),
  research_enabled boolean not null default false,
  live_signing_enabled boolean not null default false
    check (live_signing_enabled = false),
  permanently_halted boolean not null default true,
  changed_at timestamptz not null default current_timestamp
);

create table if not exists public.money_sniper_coffer_research_holds (
  hold_id text primary key,
  wallet_connection_id text not null references public.money_sniper_coffer_research_policy(wallet_connection_id),
  idempotency_key text not null unique,
  execution_id text not null unique,
  permit_id text not null unique,
  user_id text not null,
  provider text not null check (provider = 'jupiter-ultra'),
  trading_day date not null,
  currency text not null,
  notional_minor bigint not null check (notional_minor > 0),
  intent_hash text not null check (intent_hash ~ '^[a-f0-9]{64}$'),
  policy_hash text not null,
  state text not null default 'RESEARCH_HELD'
    check (state in ('RESEARCH_HELD','UNKNOWN_NEEDS_RECONCILIATION','RECONCILED_RESEARCH')),
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  can_sign boolean not null default false check (can_sign = false),
  can_submit boolean not null default false check (can_submit = false)
);
create index if not exists idx_money_sniper_research_wallet_day
  on public.money_sniper_coffer_research_holds(wallet_connection_id, trading_day);
create index if not exists idx_money_sniper_research_unresolved
  on public.money_sniper_coffer_research_holds(wallet_connection_id,state);

alter table public.money_sniper_coffer_research_policy enable row level security;
alter table public.money_sniper_coffer_research_holds enable row level security;
revoke all on table public.money_sniper_coffer_research_policy
  from public, anon, authenticated, service_role;
revoke all on table public.money_sniper_coffer_research_holds
  from public, anon, authenticated, service_role;

-- An invoker-only, privileged PostgreSQL operator may record one RESEARCH
-- hold under a serialized wallet policy row. No authority to sign/submit
-- or consume the existing Money permit is returned or even represented.
create or replace function public.money_sniper_coffer_hold_research(
  p_hold_id text,
  p_wallet_connection_id text,
  p_user_id text,
  p_idempotency_key text,
  p_execution_id text,
  p_permit_id text,
  p_intent_hash text,
  p_notional_minor bigint,
  p_expected_policy_hash text,
  p_expected_canary_version integer,
  p_observed_at timestamptz
) returns table(admitted boolean, reason text, research_hold_id text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pol public.money_sniper_coffer_research_policy%rowtype;
  state_row public.money_live_canary_state%rowtype;
  permit_row public.money_execution_permits%rowtype;
  used_minor numeric;
  used_count bigint;
begin
  if p_hold_id is null or length(p_hold_id) not between 4 and 256
    or p_wallet_connection_id is null or length(p_wallet_connection_id) not between 4 and 256
    or p_idempotency_key is null or length(p_idempotency_key) not between 4 and 256
    or p_execution_id is null or length(p_execution_id) not between 4 and 256
    or p_user_id is null or length(p_user_id) not between 1 and 256
    or p_permit_id is null or length(p_permit_id) not between 4 and 256
    or p_intent_hash !~ '^[0-9a-f]{64}$'
    or p_notional_minor is null or p_notional_minor <= 0
    or p_expected_canary_version is null or p_expected_canary_version < 0
    or p_observed_at is null or p_observed_at > current_timestamp
    or p_observed_at < current_timestamp - interval '5 seconds'
  then
    return query select false, 'INVALID_OR_STALE_RESEARCH_REQUEST'::text, null::text;
    return;
  end if;

  -- Lock the ONE wallet-wide row. Concurrent research holds on any day
  -- serialize on the same policy lock, including attempts from other hosts.
  select * into pol from public.money_sniper_coffer_research_policy
    where wallet_connection_id = p_wallet_connection_id for update;
  if not found or pol.user_id <> p_user_id or pol.permanently_halted
     or not pol.research_enabled or pol.live_signing_enabled
     or pol.policy_hash is distinct from p_expected_policy_hash
  then
    return query select false, 'COFFER_RESEARCH_OWNER_POLICY_DISABLED'::text, null::text;
    return;
  end if;

  -- Canonical Money risk state must exist with fresh metrics and no
  -- unresolved submissions; a zero balance alone never resolves a trade.
  select * into state_row from public.money_live_canary_state
    where provider=pol.provider and account_id=p_wallet_connection_id
      and trading_date=(current_timestamp at time zone 'UTC')::date
    for update;
  if not found or state_row.currency <> pol.currency
     or state_row.version <> p_expected_canary_version
     or state_row.halted or cardinality(state_row.unresolved_execution_ids) <> 0
     or state_row.risk_metric_observed_at is null
     or state_row.risk_metric_observed_at > current_timestamp
     or state_row.risk_metric_observed_at < current_timestamp - interval '5 seconds'
     or state_row.realized_loss_minor >= pol.max_loss_minor
  then
    return query select false, 'CANONICAL_MONEY_RISK_NOT_READY'::text, null::text;
    return;
  end if;

  -- Existing Money permit is checked but deliberately NOT consumed here.
  -- No transition here can authorize the existing submit/signer runtime.
  select * into permit_row from public.money_execution_permits
    where permit_id=p_permit_id for update;
  if not found or permit_row.state <> 'ISSUED'
    or permit_row.user_id <> p_user_id
    or permit_row.provider <> pol.provider
    or permit_row.capability <> 'money.trade.submit'
    or permit_row.expires_at <= current_timestamp
  then
    return query select false, 'CANONICAL_PERMIT_NOT_READY'::text, null::text;
    return;
  end if;

  if exists(select 1 from public.money_sniper_coffer_research_holds h
      where h.wallet_connection_id=p_wallet_connection_id
        and h.state <> 'RECONCILED_RESEARCH')
  then
    return query select false, 'PREVIOUS_ORDER_UNRECONCILED'::text, null::text;
    return;
  end if;

  select coalesce(sum(h.notional_minor),0), count(*) into used_minor,used_count
    from public.money_sniper_coffer_research_holds h
    where h.wallet_connection_id=p_wallet_connection_id
      and h.trading_day=(current_timestamp at time zone 'UTC')::date;
  if p_notional_minor > pol.max_order_minor
    or greatest(used_minor,state_row.submitted_notional_minor::numeric) +
        p_notional_minor > pol.max_daily_minor
    or used_count+1 > pol.max_order_count
  then
    return query select false, 'RESEARCH_EXPOSURE_CAP'::text, null::text;
    return;
  end if;

  insert into public.money_sniper_coffer_research_holds(
    hold_id,wallet_connection_id,idempotency_key,execution_id,permit_id,
    user_id,provider,trading_day,currency,notional_minor,intent_hash,policy_hash
  ) values (
    p_hold_id,p_wallet_connection_id,p_idempotency_key,p_execution_id,p_permit_id,
    p_user_id,pol.provider,(current_timestamp at time zone 'UTC')::date,pol.currency,
    p_notional_minor,p_intent_hash,pol.policy_hash
  ) on conflict do nothing;

  if not found then
    return query select false, 'DUPLICATE_OR_CONFLICTING_RESEARCH_ORDER'::text, null::text;
    return;
  end if;
  return query select true, 'RESEARCH_ONLY_NO_SIGN_AUTHORITY'::text,p_hold_id;
end;
$$;

revoke all on function public.money_sniper_coffer_hold_research(
  text,text,text,text,text,text,text,bigint,text,integer,timestamptz)
  from public, anon, authenticated, service_role;
-- Intentionally NO GRANT to service_role. A separately approved operator
-- must commission a least-privilege private DB role AFTER isolated tests.
-- Do not create an HTTP/REST route or grant web users execution.
commit;
