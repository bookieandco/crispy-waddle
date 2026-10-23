#!/usr/bin/env bash
# Runs ONLY against disposable CI PostgreSQL with existing Money schema.
# No production connection, signer, real wallet or Money permit consumption.
set -euo pipefail
: "${DATABASE_URL:?DISPOSABLE_TEST_DATABASE_URL_REQUIRED}"
if [[ "${SNIPER_ISOLATED_POSTGRES_CI:-}" != "true" ]]; then
  echo "SNIPER_DISPOSABLE_DATABASE_REQUIRED" >&2
  exit 1
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
insert into public.money_sniper_coffer_research_policy(
 wallet_connection_id,user_id,provider,currency,policy_hash,
 max_order_minor,max_daily_minor,max_loss_minor,max_order_count,
 research_enabled,permanently_halted)
values('coffer:isolated:ci','owner:ci','jupiter-ultra','LAMPORTS',
 repeat('p',64),1000,1000,1000,1,true,false);
insert into public.money_live_canary_state(
 provider,account_id,trading_date,currency,risk_metric_observed_at,
 risk_metric_evidence_ids,version)
values('jupiter-ultra','coffer:isolated:ci',(current_timestamp at time zone 'UTC')::date::text,
 'LAMPORTS',current_timestamp,array['ci:metric'],1);
insert into public.money_execution_permits(
 permit_id,nonce,state,issued_at,expires_at,action_fingerprint,
 action_request_fingerprint,authority_id,user_id,capability,provider,
 policy_version,policy_hash)
values
('ci-permit:1','ci-nonce:1','ISSUED',current_timestamp,current_timestamp+interval '10 minutes',
 repeat('f',64),'ci-action-request:1','ci-authority','owner:ci','money.trade.submit',
 'jupiter-ultra','ci-policy:1',repeat('p',64)),
('ci-permit:2','ci-nonce:2','ISSUED',current_timestamp,current_timestamp+interval '10 minutes',
 repeat('f',64),'ci-action-request:2','ci-authority','owner:ci','money.trade.submit',
 'jupiter-ultra','ci-policy:1',repeat('p',64));
do $$
begin
 if has_table_privilege('anon','public.money_sniper_coffer_research_holds','SELECT')
 or has_table_privilege('authenticated','public.money_sniper_coffer_research_policy','SELECT')
 or has_table_privilege('service_role','public.money_sniper_coffer_research_holds','INSERT')
 or has_function_privilege('anon',
 'public.money_sniper_coffer_hold_research(text,text,text,text,text,text,text,text,bigint,text,integer,timestamptz)',
 'EXECUTE')
 or has_function_privilege('authenticated',
 'public.money_sniper_coffer_hold_research(text,text,text,text,text,text,text,text,bigint,text,integer,timestamptz)',
 'EXECUTE')
 or has_function_privilege('service_role',
 'public.money_sniper_coffer_hold_research(text,text,text,text,text,text,text,text,bigint,text,integer,timestamptz)',
 'EXECUTE')
 then raise exception 'SNIPER_PRIVATE_DB_ACL_VIOLATION';
 end if;
end $$;
SQL

directory="$(mktemp -d)"
trap 'rm -rf "$directory"' EXIT
# Two independent PostgreSQL clients race for the SAME wallet policy lock.
# Unique idempotency and the wallet-wide daily cap allow exactly one hold.
hold() {
 local n="$1"
 psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -A <<SQL
select admitted from public.money_sniper_coffer_hold_research(
 'ci-research-hold:${n}','coffer:isolated:ci','owner:ci','ci-idempotency:${n}',
 'ci-execution:${n}','ci-permit:${n}',repeat('f',64),repeat('a',64),
 1000,repeat('p',64),1,current_timestamp);
SQL
}
hold 1 >"$directory/first" &
pid1=$!
hold 2 >"$directory/second" &
pid2=$!
wait "$pid1"
wait "$pid2"
admitted="$(cat "$directory/first" "$directory/second" | grep -c '^t$' || true)"
denied="$(cat "$directory/first" "$directory/second" | grep -c '^f$' || true)"
if [[ "$admitted" != "1" || "$denied" != "1" ]]; then
 echo "SNIPER_COFFFER_CAS_CONCURRENCY_FAILED: true=$admitted false=$denied" >&2
 cat "$directory/first" "$directory/second" >&2
 exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare n integer; old_state text;
begin
 select count(*) into n from public.money_sniper_coffer_research_holds;
 if n<>1 then raise exception 'SNIPER_COFFFER_ATOMIC_RACE_DUPLICATE'; end if;
 select state into old_state from public.money_execution_permits
   where permit_id='ci-permit:1';
 if old_state<>'ISSUED' then raise exception 'SNIPER_RESEARCH_CONSUMED_MONEY_PERMIT'; end if;
 select state into old_state from public.money_execution_permits
   where permit_id='ci-permit:2';
 if old_state<>'ISSUED' then raise exception 'SNIPER_RESEARCH_CONSUMED_MONEY_PERMIT'; end if;
 update public.money_sniper_coffer_research_policy
 set permanently_halted=true where wallet_connection_id='coffer:isolated:ci';
end $$;
select 'ISOLATED_SNIPER_COFFFER_CONCURRENCY_PASS' as certification;
SQL
