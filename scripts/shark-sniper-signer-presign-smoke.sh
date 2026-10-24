#!/usr/bin/env bash
# Disposable PostgreSQL only. Refuse to run on an operator/prod connection.
set -euo pipefail
: "${DATABASE_URL:?DISPOSABLE_DATABASE_URL_REQUIRED}"
[[ "${SNIPER_ISOLATED_POSTGRES_CI:-}" == "true" ]] || {
 echo 'SNIPER_DISPOSABLE_POSTGRES_REQUIRED' >&2
 exit 1
}
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
insert into public.money_wallet_connections(
 connection_id,user_id,provider,network,address,mode,status,
 evidence_ids,connected_at)
values('coffer:isolated:ci','owner:ci','phantom','SOLANA',
 '22222222222222222222222222222222','COFFER_EXECUTION_WALLET',
 'ACTIVE',array['disposable:only'],current_timestamp);
insert into public.money_signer_leases(
 lease_id,wallet_connection_id,agent_id,session_id,token_fingerprint,
 issued_at,expires_at,state,per_transaction_cap_minor,rolling_24h_cap_minor,
 max_transaction_count,allowed_destination_addresses,allowed_assets,evidence_ids)
values('ci-signer-lease:1','coffer:isolated:ci','jhadina:ci','session:ci',
 'fingerprint:nonsecret',current_timestamp-interval '1 minute',
 current_timestamp+interval '5 minutes','ACTIVE',1000,1000,1,
 array['22222222222222222222222222222222'],
 array['22222222222222222222222222222222'],array['ci:lease']);
do $$
declare h public.money_sniper_coffer_research_holds%rowtype;
 r record;n integer;
begin
 select * into h from public.money_sniper_coffer_research_holds limit 1;
 if not found then raise exception 'SNIPER_PRESIGN_RESEARCH_HOLD_REQUIRED'; end if;

 -- Reset prior research safety stop solely on disposable CI DB.
 update public.money_sniper_coffer_research_policy
 set permanently_halted=false where wallet_connection_id='coffer:isolated:ci';

 -- A revoked real signer lease must deny admission BEFORE any other write.
 update public.money_signer_leases set state='REVOKED'
 where lease_id='ci-signer-lease:1';
 select * into r from public.money_sniper_signer_stage_presign(
  'ci-presign:1',h.hold_id,'coffer:isolated:ci','owner:ci',
  h.execution_id,h.idempotency_key,h.permit_id,
  'ci-signer-lease:1',h.intent_hash,repeat('b',64));
 if r.admitted or r.reason<>'SIGNER_LEASE_REVOKED_OR_EXPIRED'
 then raise exception 'SNIPER_REVOKED_LEASE_NOT_BLOCKED'; end if;

 update public.money_signer_leases set state='ACTIVE'
 where lease_id='ci-signer-lease:1';
 select * into r from public.money_sniper_signer_stage_presign(
  'ci-presign:1',h.hold_id,'coffer:isolated:ci','owner:ci',
  h.execution_id,h.idempotency_key,h.permit_id,
  'ci-signer-lease:1',h.intent_hash,repeat('b',64));
 if not r.admitted or r.reason<>'UNSIGNED_HOLD_ONLY'
 then raise exception 'SNIPER_DURABLE_PRESIGN_FAILED:%',r.reason; end if;

 select * into r from public.money_sniper_signer_stage_presign(
  'ci-presign:1',h.hold_id,'coffer:isolated:ci','owner:ci',
  h.execution_id,h.idempotency_key,h.permit_id,
  'ci-signer-lease:1',h.intent_hash,repeat('b',64));
 if r.admitted then raise exception 'SNIPER_PRESIGN_REPLAY_ADMITTED'; end if;

 select count(*) into n from public.money_sniper_signer_presign_intents;
 if n<>1 then raise exception 'SNIPER_DURABLE_PRESIGN_CONFLICT'; end if;
 select count(*) into n from public.money_sniper_signer_presign_intents
  where state='PRESIGN_HELD' and can_sign=false and can_submit=false;
 if n<>1 then raise exception 'SNIPER_SIGNER_AUTHORITY_ESCALATION'; end if;
 select count(*) into n from public.money_execution_permits
  where state='ISSUED' and permit_id=h.permit_id;
 if n<>1 then raise exception 'SNIPER_PRESIGN_CONSUMED_MONEY_PERMIT'; end if;
 if has_function_privilege('anon',
   'public.money_sniper_signer_stage_presign(text,text,text,text,text,text,text,text,text,text)',
   'EXECUTE')
 or has_function_privilege('authenticated',
   'public.money_sniper_signer_stage_presign(text,text,text,text,text,text,text,text,text,text,text)',
   'EXECUTE')
 or has_function_privilege('service_role',
   'public.money_sniper_signer_stage_presign(text,text,text,text,text,text,text,text,text,text,text)',
   'EXECUTE')
 or has_table_privilege('service_role','public.money_sniper_signer_presign_intents','INSERT')
 then raise exception 'SNIPER_PRESIGN_PRIVATE_ACL_FAILED'; end if;

 update public.money_sniper_coffer_research_policy
 set permanently_halted=true where wallet_connection_id='coffer:isolated:ci';
end $$;
select 'SNIPER_DISPOSABLE_PRESIGN_CERTIFIED_NO_SIGN' as result;
SQL
