-- SOCIAL-ID.26 — ISOLATED POSTGRESQL REHEARSAL ONLY. NOT A SUPABASE MIGRATION.
-- Never run on SWLC. Use an isolated disposable PG15+ instance.
-- Objects live exclusively in social_id26_rehearsal, with no Data API grants.
-- Receipt rows are SIMULATED. This does not grant real Action/Security permits.
create schema if not exists social_id26_rehearsal;
revoke all on schema social_id26_rehearsal from public;

create table if not exists social_id26_rehearsal.identities (
  owner_id uuid not null, account_id text not null,
  version integer not null check(version > 0),
  identity_fingerprint text not null check(length(identity_fingerprint)>0),
  primary key(owner_id,account_id)
);
create table if not exists social_id26_rehearsal.packets (
  owner_id uuid not null, packet_id text not null,
  packet_fingerprint text not null,
  composite_fingerprint text not null,
  expires_at timestamptz not null,
  account_bindings jsonb not null check(jsonb_typeof(account_bindings)='array'),
  child_specs jsonb not null check(jsonb_typeof(child_specs)='array'),
  created_at timestamptz not null default now(),
  primary key(owner_id,packet_id)
);
create table if not exists social_id26_rehearsal.receipts (
  id uuid primary key, owner_id uuid not null, action_id text not null,
  capability text not null, fingerprint text not null,
  status text not null check(status in ('pending','approved','consumed','expired')),
  expires_at timestamptz not null, consumed_at timestamptz,
  unique(owner_id,action_id)
);
create table if not exists social_id26_rehearsal.batches (
  owner_id uuid not null, packet_id text not null,
  parent_receipt_id uuid not null references social_id26_rehearsal.receipts(id),
  composite_fingerprint text not null,
  payload jsonb not null check(
    jsonb_typeof(payload)='object'
    and payload->>'state'='PERSISTED_REVIEW_ONLY'
    and payload->>'canExecute'='false'
    and payload->>'canPublish'='false'
    and payload->>'canComment'='false'
    and payload->>'canSpend'='false'
  ),
  created_at timestamptz not null default now(),
  primary key(owner_id,packet_id),
  unique(owner_id,parent_receipt_id),
  foreign key(owner_id,packet_id)
    references social_id26_rehearsal.packets(owner_id,packet_id)
);
create table if not exists social_id26_rehearsal.outbox (
  owner_id uuid not null, packet_id text not null, child_action_id text not null,
  child_receipt_id uuid not null references social_id26_rehearsal.receipts(id),
  payload jsonb not null check(
    jsonb_typeof(payload)='object'
    and payload->>'state'='AWAITING_DISPATCH_CERTIFICATION'
    and payload->>'canExecute'='false'
    and payload->>'canDispatch'='false'
    and payload->>'requiresFreshActionSecurityPermit'='true'
  ),
  created_at timestamptz not null default now(),
  primary key(owner_id,packet_id,child_action_id),
  unique(owner_id,child_receipt_id),
  foreign key(owner_id,packet_id)
    references social_id26_rehearsal.batches(owner_id,packet_id)
);
-- Do not grant USAGE, DML or EXECUTE to anon/authenticated/public.
revoke all on all tables in schema social_id26_rehearsal from public;

-- This verifies the *stored* version bindings, but it does not create a trusted
-- canonical packet admission pathway. That remains a separately blocked gate.
create or replace function social_id26_rehearsal.assert_current_identities(
 p_owner uuid,p_bindings jsonb
) returns void language plpgsql security invoker
set search_path=pg_catalog,social_id26_rehearsal,pg_temp
as $function$
declare b jsonb; v_seen text[]:=array[]::text[]; v_id text;
begin
 if p_owner is null or p_bindings is null or jsonb_typeof(p_bindings) is distinct from 'array'
 then raise exception 'ID26_IDENTITY_BINDINGS_INVALID'; end if;
 for b in select value from jsonb_array_elements(p_bindings) loop
   v_id:=b->>'accountId';
   if nullif(v_id,'') is null or v_id=any(v_seen) then
     raise exception 'ID26_IDENTITY_BINDINGS_DUPLICATE_OR_BLANK';
   end if;
   v_seen:=array_append(v_seen,v_id);
   if not exists (
     select 1 from social_id26_rehearsal.identities i
     where i.owner_id=p_owner and i.account_id=v_id
       and i.version=(b->>'identityVersion')::integer
       and i.identity_fingerprint=b->>'identityFingerprint'
   ) then raise exception 'ID26_STALE_OR_FOREIGN_IDENTITY'; end if;
 end loop;
end;
$function$;

create or replace function social_id26_rehearsal.stage_parent(
 p_owner uuid,p_packet text,p_receipt uuid,
 p_expected_action_id text,p_expected_type text,
 p_expected_fingerprint text,p_batch jsonb
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,social_id26_rehearsal,pg_temp
as $function$
declare v_packet social_id26_rehearsal.packets%rowtype;
        v_receipt social_id26_rehearsal.receipts%rowtype;
        v_existing social_id26_rehearsal.batches%rowtype;
begin
 if p_owner is null or nullif(p_packet,'') is null or p_receipt is null
    or nullif(p_expected_action_id,'') is null
    or p_expected_type is distinct from 'social.weekly.review'
    or nullif(p_expected_fingerprint,'') is null
    or p_batch is null or jsonb_typeof(p_batch) is distinct from 'object'
 then raise exception 'ID26_PARENT_BAD_INPUT'; end if;
 -- Parent packet row is the serialization lock for both stage functions.
 select * into v_packet from social_id26_rehearsal.packets
 where owner_id=p_owner and packet_id=p_packet for update;
 if not found or v_packet.expires_at<=clock_timestamp() or
    v_packet.composite_fingerprint is distinct from p_expected_fingerprint
 then raise exception 'ID26_PARENT_STALE_PACKET'; end if;
 perform social_id26_rehearsal.assert_current_identities(p_owner,v_packet.account_bindings);
 if p_batch->>'schema' is distinct from 'jhadina.social.weekly-child-batch.v1'
    or p_batch->>'ownerUserId' is distinct from p_owner::text
    or p_batch->>'packetId' is distinct from p_packet
    or p_batch->>'approvalReceiptId' is distinct from p_receipt::text
    or p_batch->>'compositeFingerprint' is distinct from v_packet.composite_fingerprint
    or p_batch->>'packetFingerprint' is distinct from v_packet.packet_fingerprint
    or nullif(p_batch->>'validUntil','')::timestamptz is distinct from v_packet.expires_at
    or p_batch->>'state' is distinct from 'PERSISTED_REVIEW_ONLY'
    or p_batch->>'canExecute' is distinct from 'false'
    or p_batch->>'canPublish' is distinct from 'false'
    or p_batch->>'canComment' is distinct from 'false'
    or p_batch->>'canSpend' is distinct from 'false'
    or p_batch->'children' is distinct from v_packet.child_specs
 then raise exception 'ID26_PARENT_PAYLOAD_MISMATCH'; end if;
 select * into v_existing from social_id26_rehearsal.batches
 where owner_id=p_owner and packet_id=p_packet;
 if found then
   if v_existing.parent_receipt_id=p_receipt
     and v_existing.composite_fingerprint=p_expected_fingerprint
     and v_existing.payload=p_batch then return v_existing.payload; end if;
   raise exception 'ID26_PARENT_IDEMPOTENCY_CONFLICT';
 end if;
 select * into v_receipt from social_id26_rehearsal.receipts
 where id=p_receipt and owner_id=p_owner for update;
 if not found or v_receipt.action_id is distinct from p_expected_action_id
    or v_receipt.capability is distinct from p_expected_type
    or v_receipt.fingerprint is distinct from p_expected_fingerprint
    or v_receipt.status is distinct from 'approved' or v_receipt.expires_at<=clock_timestamp()
 then raise exception 'ID26_PARENT_APPROVAL_INVALID'; end if;
 insert into social_id26_rehearsal.batches
  (owner_id,packet_id,parent_receipt_id,composite_fingerprint,payload)
 values(p_owner,p_packet,p_receipt,p_expected_fingerprint,p_batch);
 update social_id26_rehearsal.receipts set status='consumed',
   consumed_at=clock_timestamp() where id=p_receipt and status='approved';
 if not found then raise exception 'ID26_PARENT_RECEIPT_RACE'; end if;
 return p_batch;
end;
$function$;

create or replace function social_id26_rehearsal.stage_child(
 p_owner uuid,p_packet text,p_child text,p_receipt uuid,
 p_expected_action_id text,p_capability text,p_expected_fingerprint text,
 p_parent_receipt uuid,p_packet_fingerprint text,p_child_fingerprint text,
 p_proposal jsonb
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,social_id26_rehearsal,pg_temp
as $function$
declare v_packet social_id26_rehearsal.packets%rowtype;
        v_parent social_id26_rehearsal.batches%rowtype;
        v_receipt social_id26_rehearsal.receipts%rowtype;
        v_existing social_id26_rehearsal.outbox%rowtype;
        v_child jsonb; v_capability text;
begin
 if p_owner is null or nullif(p_packet,'') is null
    or nullif(p_child,'') is null or p_receipt is null or
    p_parent_receipt is null or p_proposal is null
    or jsonb_typeof(p_proposal) is distinct from 'object'
 then raise exception 'ID26_CHILD_BAD_INPUT'; end if;
 select * into v_packet from social_id26_rehearsal.packets
 where owner_id=p_owner and packet_id=p_packet for update;
 if not found or v_packet.expires_at<=clock_timestamp() or
    v_packet.composite_fingerprint is distinct from p_packet_fingerprint
 then raise exception 'ID26_CHILD_STALE_PACKET'; end if;
 perform social_id26_rehearsal.assert_current_identities(p_owner,v_packet.account_bindings);
 select * into v_parent from social_id26_rehearsal.batches
 where owner_id=p_owner and packet_id=p_packet and parent_receipt_id=p_parent_receipt;
 if not found or v_parent.composite_fingerprint is distinct from p_packet_fingerprint
 then raise exception 'ID26_CHILD_PARENT_MISSING'; end if;
 if not exists(select 1 from social_id26_rehearsal.receipts
   where id=p_parent_receipt and owner_id=p_owner
     and capability='social.weekly.review' and status='consumed')
 then raise exception 'ID26_CHILD_PARENT_NOT_CONSUMED'; end if;
 select value into v_child from jsonb_array_elements(v_parent.payload->'children')
 where value->>'actionId'=p_child;
 if not found or v_child->>'actionFingerprint' is distinct from p_child_fingerprint
 then raise exception 'ID26_CHILD_NOT_IN_REVIEW'; end if;
 v_capability:=case v_child->>'actionKind'
   when 'organic_publication' then 'public.publish'
   when 'public_comment' then 'consequential.outreach'
   when 'paid_campaign' then 'paid-ad.publish'
   when 'director_production' then 'take.generate'
   else null end;
 if v_capability is null or v_capability is distinct from p_capability
    or p_proposal->>'schema' is distinct from 'jhadina.social.weekly-child-outbox.v1'
    or p_proposal->>'ownerUserId' is distinct from p_owner::text
    or p_proposal->>'packetId' is distinct from p_packet
    or p_proposal->>'childActionId' is distinct from p_child
    or p_proposal->>'parentApprovalReceiptId' is distinct from p_parent_receipt::text
    or p_proposal->>'approvalReceiptId' is distinct from p_receipt::text
    or p_proposal->>'actionKind' is distinct from v_child->>'actionKind'
    or p_proposal->>'capability' is distinct from p_capability
    or p_proposal->>'childFingerprint' is distinct from p_child_fingerprint
    or p_proposal->>'reviewedWeeklyFingerprint' is distinct from p_packet_fingerprint
    or p_proposal->>'actionId' is distinct from p_expected_action_id
    or p_proposal->>'fingerprint' is distinct from p_expected_fingerprint
    or p_proposal->>'state' is distinct from 'AWAITING_DISPATCH_CERTIFICATION'
    or p_proposal->>'canDispatch' is distinct from 'false'
    or p_proposal->>'canExecute' is distinct from 'false'
    or p_proposal->>'requiresFreshActionSecurityPermit' is distinct from 'true'
 then raise exception 'ID26_CHILD_PAYLOAD_MISMATCH'; end if;
 select * into v_existing from social_id26_rehearsal.outbox
 where owner_id=p_owner and packet_id=p_packet and child_action_id=p_child;
 if found then
   if v_existing.child_receipt_id=p_receipt and v_existing.payload=p_proposal
   then return v_existing.payload; end if;
   raise exception 'ID26_CHILD_IDEMPOTENCY_CONFLICT';
 end if;
 select * into v_receipt from social_id26_rehearsal.receipts
 where id=p_receipt and owner_id=p_owner for update;
 if not found or v_receipt.action_id is distinct from p_expected_action_id
   or v_receipt.capability is distinct from p_capability
   or v_receipt.fingerprint is distinct from p_expected_fingerprint
   or v_receipt.status is distinct from 'approved' or v_receipt.expires_at<=clock_timestamp()
 then raise exception 'ID26_CHILD_APPROVAL_INVALID'; end if;
 insert into social_id26_rehearsal.outbox
  (owner_id,packet_id,child_action_id,child_receipt_id,payload)
 values(p_owner,p_packet,p_child,p_receipt,p_proposal);
 update social_id26_rehearsal.receipts set status='consumed',
   consumed_at=clock_timestamp() where id=p_receipt and status='approved';
 if not found then raise exception 'ID26_CHILD_RECEIPT_RACE'; end if;
 return p_proposal;
end;
$function$;

-- In bare Postgres functions have PUBLIC EXECUTE by default. Explicitly revoke.
revoke all on function social_id26_rehearsal.assert_current_identities(uuid,jsonb) from public;
revoke all on function social_id26_rehearsal.stage_parent(uuid,text,uuid,text,text,text,jsonb) from public;
revoke all on function social_id26_rehearsal.stage_child(uuid,text,text,uuid,text,text,text,uuid,text,text,jsonb) from public;
-- DO NOT GRANT USAGE / EXECUTE TO anon, authenticated OR service_role.
