-- SHARK-SNIPER.LIVE-SIGNER.51–.55 — STAGED SOURCE ONLY.
-- No production apply. This records ORIGINAL, UNSIGNED intent before ANY
-- signer call. It does not grant use of a private key or permission to trade.
begin;

create table if not exists public.money_sniper_signer_presign_intents (
  presign_id text primary key,
  research_hold_id text not null unique
    references public.money_sniper_coffer_research_holds(hold_id),
  wallet_connection_id text not null,
  owner_user_id text not null,
  execution_id text not null unique,
  idempotency_key text not null unique,
  permit_id text not null unique,
  signer_lease_id text not null,
  unsigned_transaction_hash text not null
    check (unsigned_transaction_hash ~ '^[0-9a-f]{64}$'),
  intent_hash text not null check (intent_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'PRESIGN_HELD'
    check (state in ('PRESIGN_HELD','SIGNING_UNKNOWN','SETTLEMENT_UNKNOWN',
      'RECONCILED_OBSERVED','REVOKED_HOLD')),
  primary_signature text,
  observed_onchain_slot bigint,
  evidence_ids text[] not null default '{}',
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  can_sign boolean not null default false check (can_sign=false),
  can_submit boolean not null default false check (can_submit=false)
);
create index if not exists idx_sniper_presign_wallet_state
  on public.money_sniper_signer_presign_intents(wallet_connection_id,state);

alter table public.money_sniper_signer_presign_intents enable row level security;
alter table public.money_sniper_signer_presign_intents force row level security;
revoke all on public.money_sniper_signer_presign_intents
 from public, anon, authenticated, service_role;

-- One wallet-wide serialization point, also shared with .46 research policy.
-- All comparisons made UNDER a PG row lock, not a read/then-write race.
-- A staged record is a HOLD ONLY; the Money permit stays ISSUED.
create or replace function public.money_sniper_signer_stage_presign(
 p_presign_id text,p_research_hold_id text,p_wallet_connection_id text,
 p_user_id text,p_execution_id text,p_idempotency_key text,p_permit_id text,
 p_signer_lease_id text,p_intent_hash text,p_unsigned_tx_hash text
) returns table(admitted boolean, reason text, presign_id text)
language plpgsql security invoker set search_path = ''
as $$
declare
 pol public.money_sniper_coffer_research_policy%rowtype;
 hold_row public.money_sniper_coffer_research_holds%rowtype;
 lease_row public.money_signer_leases%rowtype;
 money_permit public.money_execution_permits%rowtype;
 gate_state public.money_live_canary_state%rowtype;
begin
 if p_presign_id is null or length(p_presign_id) not between 8 and 256
 or p_wallet_connection_id is null or length(p_wallet_connection_id) not between 4 and 256
 or p_signer_lease_id is null or length(p_signer_lease_id) not between 4 and 256
 or p_research_hold_id is null or length(p_research_hold_id) not between 4 and 256
 or p_intent_hash is null or p_intent_hash !~ '^[0-9a-f]{64}$'
 or p_unsigned_tx_hash is null or p_unsigned_tx_hash !~ '^[0-9a-f]{64}$'
 then
  return query select false,'INVALID_PRESIGN_INPUT'::text,null::text;return;
 end if;
 select * into pol from public.money_sniper_coffer_research_policy
  where wallet_connection_id=p_wallet_connection_id for update;
 if not found or pol.user_id is distinct from p_user_id
 or pol.permanently_halted or not pol.research_enabled or pol.live_signing_enabled
 then
  return query select false,'COFFER_NOT_IN_RESEARCH_HOLD'::text,null::text;return;
 end if;
 select * into hold_row from public.money_sniper_coffer_research_holds
  where hold_id=p_research_hold_id for update;
 if not found or hold_row.state<>'RESEARCH_HELD'
 or hold_row.wallet_connection_id is distinct from p_wallet_connection_id
 or hold_row.user_id is distinct from p_user_id
 or hold_row.execution_id is distinct from p_execution_id
 or hold_row.idempotency_key is distinct from p_idempotency_key
 or hold_row.permit_id is distinct from p_permit_id
 or hold_row.intent_hash is distinct from p_intent_hash
 or hold_row.policy_hash is distinct from pol.policy_hash
 then
  return query select false,'RESEARCH_HOLD_NOT_MATCHED'::text,null::text;return;
 end if;
 select * into lease_row from public.money_signer_leases
  where lease_id=p_signer_lease_id for update;
 if not found or lease_row.wallet_connection_id is distinct from p_wallet_connection_id
 or lease_row.state<>'ACTIVE' or lease_row.expires_at<=current_timestamp
 or lease_row.issued_at>current_timestamp
 or lease_row.per_transaction_cap_minor<hold_row.notional_minor
 then
  return query select false,'SIGNER_LEASE_REVOKED_OR_EXPIRED'::text,null::text;return;
 end if;
 select * into money_permit from public.money_execution_permits
  where permit_id=p_permit_id for update;
 if not found or money_permit.state<>'ISSUED'
 or money_permit.user_id is distinct from p_user_id
 or money_permit.provider<>'jupiter-ultra'
 or money_permit.capability<>'money.trade.submit'
 or money_permit.expires_at<=current_timestamp
 then
  return query select false,'MONEY_PERMIT_NOT_EXECUTABLE'::text,null::text;return;
 end if;
 select * into gate_state from public.money_live_canary_state
  where provider='jupiter-ultra' and account_id=p_wallet_connection_id
  and trading_date=(current_timestamp at time zone 'UTC')::date::text for update;
 if not found or gate_state.halted
 or cardinality(gate_state.unresolved_execution_ids)>0
 or gate_state.risk_metric_observed_at is null
 or gate_state.risk_metric_observed_at < current_timestamp - interval '5 seconds'
 then
  return query select false,'MONEY_RISK_OR_UNRESOLVED_EXECUTION'::text,null::text;return;
 end if;
 if exists(select 1 from public.money_sniper_signer_presign_intents p
  where p.wallet_connection_id=p_wallet_connection_id
    and p.state in ('PRESIGN_HELD','SIGNING_UNKNOWN','SETTLEMENT_UNKNOWN'))
 then
  return query select false,'PREVIOUS_SIGNER_ATTEMPT_UNRESOLVED'::text,null::text;return;
 end if;
 insert into public.money_sniper_signer_presign_intents(
 presign_id,research_hold_id,wallet_connection_id,owner_user_id,
 execution_id,idempotency_key,permit_id,signer_lease_id,
 unsigned_transaction_hash,intent_hash
 ) values (
 p_presign_id,p_research_hold_id,p_wallet_connection_id,p_user_id,
 p_execution_id,p_idempotency_key,p_permit_id,p_signer_lease_id,
 p_unsigned_tx_hash,p_intent_hash
 ) on conflict do nothing;
 if not found then
  return query select false,'PRESIGN_IDEMPOTENCY_CONFLICT'::text,null::text;return;
 end if;
 return query select true,'UNSIGNED_HOLD_ONLY'::text,p_presign_id;
end;
$$;
revoke all on function public.money_sniper_signer_stage_presign(
 text,text,text,text,text,text,text,text,text,text
) from public,anon,authenticated,service_role;

-- No function to transition to SIGNING_UNKNOWN or consume the Money permit
-- exists in this migration. A real isolated signer must own an independently
-- reviewed atomic permit+budget+nonce reservation before signing and MUST
-- persist SIGNING_UNKNOWN before any external signing call.
commit;
