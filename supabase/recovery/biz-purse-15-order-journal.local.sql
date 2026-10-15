-- BIZ-PURSE.15 / LOCAL REHEARSAL ONLY. NOT A PRODUCTION MIGRATION.
-- This SQL must never be added to supabase/migrations until DB-01..03 in
-- https://github.com/bookieandco/crispy-waddle/issues/1276 are certified.
-- Database name, operator privilege and no-public-grants are deliberately fenced.
begin;
do $guard$
begin
 if pg_catalog.current_database() !~ '^biz_purse_recovery_[a-z0-9_]+$' then
  raise exception 'BIZ_PURSE_15_DISPOSABLE_POSTGRES_REQUIRED';
 end if;
end
$guard$;

create schema if not exists biz_purse_15_recovery;
revoke all on schema biz_purse_15_recovery from public;
revoke all on schema biz_purse_15_recovery from anon, authenticated;
grant usage on schema biz_purse_15_recovery to service_role;

create table if not exists biz_purse_15_recovery.order_streams (
 owner_user_id uuid not null,
 order_id text not null check (length(order_id) between 1 and 256),
 last_sequence bigint not null default 0 check(last_sequence>=0),
 last_event_id text,
 primary key (owner_user_id,order_id),
 constraint head_consistency check ((last_sequence=0 and last_event_id is null) or
 (last_sequence>0 and last_event_id is not null))
);

create table if not exists biz_purse_15_recovery.order_events (
 owner_user_id uuid not null,
 order_id text not null,
 sequence bigint not null check(sequence>0),
 event_id text not null check(length(event_id) between 1 and 256),
 kind text not null check(kind in ('ORDER_CREATED','PROVIDER_UNKNOWN','PAYMENT_SETTLED','PAYMENT_REFUNDED','DELIVERY_ACCEPTED')),
 provider text,
 provider_event_ref text,
 provider_payment_id text,
 event_data jsonb not null check(jsonb_typeof(event_data)='object'),
 observed_at timestamptz not null,
 recorded_at timestamptz not null default now(),
 primary key (owner_user_id,order_id,sequence),
 foreign key (owner_user_id,order_id)
  references biz_purse_15_recovery.order_streams(owner_user_id,order_id) on delete restrict,
 unique (owner_user_id,event_id),
 constraint provider_pair_check check ((provider is null and provider_event_ref is null) or
    (provider is not null and provider_event_ref is not null)),
 constraint payment_provider_fields check(
   (kind in ('PAYMENT_SETTLED','PAYMENT_REFUNDED') and provider is not null and provider_payment_id is not null)
   or (kind not in ('PAYMENT_SETTLED','PAYMENT_REFUNDED') and provider_payment_id is null and provider is null))
);
create unique index if not exists bp15_provider_event_unique
 on biz_purse_15_recovery.order_events(owner_user_id,provider,provider_event_ref)
 where provider_event_ref is not null;
create unique index if not exists bp15_settled_payment_unique
 on biz_purse_15_recovery.order_events(owner_user_id,provider,provider_payment_id)
 where kind='PAYMENT_SETTLED';

alter table biz_purse_15_recovery.order_streams enable row level security;
alter table biz_purse_15_recovery.order_events enable row level security;
revoke all on biz_purse_15_recovery.order_streams from public,anon,authenticated;
revoke all on biz_purse_15_recovery.order_events from public,anon,authenticated;
grant select,insert,update on biz_purse_15_recovery.order_streams to service_role;
grant select,insert on biz_purse_15_recovery.order_events to service_role;
-- Intentionally NO RLS policies and NO browser exposure. service_role bypass
-- is an owner-bound *server-only* trust boundary requiring separate review.

create or replace function biz_purse_15_recovery.append_order_event_atomic(
 p_owner uuid, p_order text, p_event jsonb,
 p_expected_last_sequence bigint, p_expected_last_event_id text,
 p_provider text default null, p_provider_event_ref text default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $fn$
declare
 v_sequence bigint;
 v_kind text;
 v_event_id text;
 v_prior biz_purse_15_recovery.order_streams%rowtype;
 v_existing biz_purse_15_recovery.order_events%rowtype;
 v_payment_id text;
begin
 if current_database() !~ '^biz_purse_recovery_[a-z0-9_]+$' or current_user not in ('postgres','service_role') then
  raise exception 'BIZ_PURSE_15_PRIVATE_DISPOSABLE_ONLY';
 end if;
 if p_owner is null or p_order is null or length(p_order) not between 1 and 256 or
    p_expected_last_sequence is null or p_expected_last_sequence<0 or
    (p_expected_last_sequence=0 and p_expected_last_event_id is not null) or
    (p_expected_last_sequence>0 and (p_expected_last_event_id is null or p_expected_last_event_id='')) then
  raise exception 'BIZ_PURSE_15_EXPECTED_HEAD_INVALID';
 end if;
 if p_event is null or jsonb_typeof(p_event)<>'object' or
    p_event->>'ownerUserId' is distinct from p_owner::text or
    p_event->>'orderId' is distinct from p_order then
  raise exception 'BIZ_PURSE_15_EVENT_OWNER_OR_ORDER_MISMATCH';
 end if;
 v_sequence:=(p_event->>'sequence')::bigint;
 v_kind:=p_event->>'kind';
 v_event_id:=p_event->>'eventId';
 v_payment_id:=nullif(p_event->>'providerPaymentId','');
 if v_sequence is null or v_sequence<>p_expected_last_sequence+1 or
    v_event_id is null or length(v_event_id) not between 1 and 256 or
    nullif(p_event->>'evidenceId','') is null or
    (v_sequence=1 and v_kind<>'ORDER_CREATED') or
    (v_sequence>1 and v_kind='ORDER_CREATED') or
    v_kind not in ('ORDER_CREATED','PROVIDER_UNKNOWN','PAYMENT_SETTLED','PAYMENT_REFUNDED','DELIVERY_ACCEPTED') then
  raise exception 'BIZ_PURSE_15_EVENT_SHAPE_INVALID';
 end if;
 if (v_kind in ('PAYMENT_SETTLED','PAYMENT_REFUNDED') and
     (nullif(p_provider,'') is null or nullif(p_provider_event_ref,'') is null or v_payment_id is null or
      (p_event->>'amountMinor') !~ '^[0-9]+$'))
    or (v_kind not in ('PAYMENT_SETTLED','PAYMENT_REFUNDED') and
      (p_provider is not null or p_provider_event_ref is not null or v_payment_id is not null)) then
  raise exception 'BIZ_PURSE_15_PROVIDER_IDENTITY_INVALID';
 end if;
 if p_event ?| array['canCharge','canFulfill','canTrade','moneyMovementAuthorized','paymentAuthorized','ownerPayoutAuthorized'] then
  raise exception 'BIZ_PURSE_15_FINANCIAL_AUTHORITY_PAYLOAD_FORBIDDEN';
 end if;

 -- Insert stream first, then lock it. All writers for the same order serialize.
 insert into biz_purse_15_recovery.order_streams(owner_user_id,order_id)
 values (p_owner,p_order) on conflict do nothing;
 select * into strict v_prior from biz_purse_15_recovery.order_streams
  where owner_user_id=p_owner and order_id=p_order for update;

 -- Event ID is globally unique within an owner, even across different orders.
 select * into v_existing from biz_purse_15_recovery.order_events
  where owner_user_id=p_owner and event_id=v_event_id;
 if found then
  if v_existing.order_id<>p_order or v_existing.sequence<>v_sequence or
     v_existing.event_data<>p_event or
     v_existing.provider is distinct from p_provider or
     v_existing.provider_event_ref is distinct from p_provider_event_ref then
   raise exception 'BIZ_PURSE_15_REPLAY_CONFLICT';
  end if;
  return jsonb_build_object('outcome','EXACT_REPLAY','ownerUserId',p_owner::text,
   'orderId',p_order,'eventId',v_event_id,'sequence',v_sequence);
 end if;

 if v_prior.last_sequence<>p_expected_last_sequence or
    v_prior.last_event_id is distinct from p_expected_last_event_id then
  raise exception 'BIZ_PURSE_15_STALE_HEAD';
 end if;

 insert into biz_purse_15_recovery.order_events
  (owner_user_id,order_id,sequence,event_id,kind,provider,provider_event_ref,
   provider_payment_id,event_data,observed_at)
 values
  (p_owner,p_order,v_sequence,v_event_id,v_kind,p_provider,p_provider_event_ref,
   v_payment_id,p_event,(p_event->>'observedAt')::timestamptz);

 update biz_purse_15_recovery.order_streams
  set last_sequence=v_sequence,last_event_id=v_event_id
  where owner_user_id=p_owner and order_id=p_order;
 return jsonb_build_object('outcome','APPENDED','ownerUserId',p_owner::text,
  'orderId',p_order,'eventId',v_event_id,'sequence',v_sequence);
end
$fn$;

revoke all on function biz_purse_15_recovery.append_order_event_atomic(uuid,text,jsonb,bigint,text,text,text)
 from public,anon,authenticated;
grant execute on function biz_purse_15_recovery.append_order_event_atomic(uuid,text,jsonb,bigint,text,text,text)
 to service_role;

-- Do not commit anywhere except a genuinely disposable database matching guard.
commit;
