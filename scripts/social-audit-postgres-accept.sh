#!/usr/bin/env bash
# SOC-RECOVER.08: Real guarded audit function semantics in disposable PG only.
set -euo pipefail
HOST="${PGHOST:-127.0.0.1}"
DB="${PGDATABASE:-social_audit_ci}"
[[ "$HOST" == "127.0.0.1" || "$HOST" == "localhost" ]] || { echo "SOCIAL_AUDIT_LOOPBACK_ONLY"; exit 1; }
[[ "$DB" == "social_audit_ci" ]] || { echo "SOCIAL_AUDIT_FIXTURE_DB_REQUIRED"; exit 1; }
export PGHOST="$HOST" PGPORT="${PGPORT:-5432}" PGDATABASE="$DB" PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-social-audit-ci-only}"
command -v psql >/dev/null || exit 1
command -v python3 >/dev/null || exit 1
COUNT="$(psql -XAt -v ON_ERROR_STOP=1 -c "select count(*) from pg_tables where schemaname='public' and tablename like 'jhadina_audit_%'")"
[[ "$COUNT" == 0 ]] || { echo "SOCIAL_AUDIT_PREEXISTING_DATA_DENIED"; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ORIGINAL="$TMP/original.sql"
PATCHED="$TMP/patched.sql"
PROPOSAL="supabase/proposals/social_core_recover_08_audit_domain_UNAPPLIED.sql"

# Extract the original read-only production function text from the staged,
# checksum-pinned proposal; remove only the added domain gate in the fixture.
python3 - "$PROPOSAL" "$ORIGINAL" <<'PY'
from pathlib import Path
import re,sys
src=Path(sys.argv[1]).read_text()
start=src.index('CREATE OR REPLACE FUNCTION public.append_jhadina_audit_event(')
end=src.index('\n\n-- Keep existing grants unchanged;',start)
fn=src[start:end]
gate="""  -- Social audit events are authorization evidence only from the verified server.
  -- This does not affect other Action Core audit domains.
  if p_domain = 'social' and auth.role() is distinct from 'service_role' then
    raise exception 'JHADINA_SOCIAL_AUDIT_SERVER_ONLY';
  end if;

"""
assert fn.count(gate)==1
Path(sys.argv[2]).write_text(fn.replace(gate,"")+"\n")
PY

psql -X -v ON_ERROR_STOP=1 <<'SQL'
create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin bypassrls;
create or replace function auth.uid() returns uuid language sql stable as
  $body$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$body$;
create or replace function auth.role() returns text language sql stable as
  $body$select nullif(current_setting('request.jwt.claim.role',true),'')$body$;
grant usage on schema auth to authenticated, anon, service_role;
create table public.jhadina_audit_ledger (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique, request_id text not null,
  actor_id uuid not null, domain text not null,
  capability text not null, decision text not null, status text not null,
  occurred_at timestamptz not null, previous_hash text not null,
  event_hash text not null, metadata jsonb not null,
  created_at timestamptz not null default now()
);
create table public.jhadina_audit_ledger_head (
  id boolean primary key default true,
  head_hash text not null, event_count bigint not null,
  updated_at timestamptz not null default now()
);
insert into public.jhadina_audit_ledger_head(id,head_hash,event_count) values (true,'GENESIS',0);
SQL
psql -X -v ON_ERROR_STOP=1 -f "$ORIGINAL"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
grant execute on function public.append_jhadina_audit_event(text,text,uuid,text,text,text,text,timestamptz,jsonb) to authenticated,service_role;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
-- Baseline: the unguarded production function permits self-authored Social events.
select public.append_jhadina_audit_event(
  'fixture-before','fixture-req','11111111-1111-4111-8111-111111111111',
  'social','public.publish','allow','completed',now(),'{}'::jsonb);
rollback;
SQL

# Local PostgreSQL formatting may differ from Supabase's pg_get_functiondef.
# Preserve the submitted pinned LIVE hash; adapt only the *temporary* CI copy.
ACTUAL="$(psql -XAt -v ON_ERROR_STOP=1 -c "select md5(pg_get_functiondef('public.append_jhadina_audit_event(text,text,uuid,text,text,text,text,timestamptz,jsonb)'::regprocedure))")"
python3 - "$PROPOSAL" "$PATCHED" "$ACTUAL" <<'PY'
from pathlib import Path
import re,sys
src=Path(sys.argv[1]).read_text()
loc=re.search(r"(if md5\(pg_get_functiondef\('[^']+'::regprocedure\)\) <> ')([a-f0-9]{32})(')",src)
assert loc, "Live SQL source drift guard missing"
assert re.fullmatch('[0-9a-f]{32}',sys.argv[3])
local=src[:loc.start(2)]+sys.argv[3]+src[loc.end(2):]
Path(sys.argv[2]).write_text(local)
PY
psql -X -v ON_ERROR_STOP=1 -f "$PATCHED"

psql -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
begin
  begin
    perform public.append_jhadina_audit_event(
      'fixture-denied','fixture-req','11111111-1111-4111-8111-111111111111',
      'social','public.publish','allow','completed',now(),'{}'::jsonb);
    raise exception 'SOCIAL_AUDIT_CLIENT_FORGERY_ACCEPTED';
  exception when raise_exception then
    if SQLERRM != 'JHADINA_SOCIAL_AUDIT_SERVER_ONLY' then raise; end if;
  end;
  -- Unrelated domains retain existing actor-bound append behavior.
  perform public.append_jhadina_audit_event(
    'fixture-growth','fixture-req','11111111-1111-4111-8111-111111111111',
    'growth','growth.draft.approve','allow','started',now(),'{}'::jsonb);
end
$test$;
commit;

begin;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $test$
begin
  perform public.append_jhadina_audit_event(
    'fixture-trusted','fixture-req','11111111-1111-4111-8111-111111111111',
    'social','public.publish','allow','approval_required',now(),'{}'::jsonb);
end
$test$;
commit;
SQL

psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $check$
declare n integer; head_count bigint; head_hash text;
begin
  select count(*) into n from public.jhadina_audit_ledger;
  select event_count,head_hash into head_count,head_hash
    from public.jhadina_audit_ledger_head where id=true;
  if n!=2 or head_count!=2 or length(head_hash)!=64 then
    raise exception 'SOCIAL_AUDIT_HASH_CHAIN_BROKEN:%:%:%',n,head_count,head_hash; end if;
  if (select count(*) from public.jhadina_audit_ledger where domain='social')!=1 then
    raise exception 'SOCIAL_AUDIT_FORGED_OR_MISSING'; end if;
  if (select count(*) from public.jhadina_audit_ledger where domain='growth')!=1 then
    raise exception 'SOCIAL_AUDIT_OTHER_DOMAINS_REGRESSED'; end if;
end
$check$;
SQL
echo "SOCIAL_CORE_RECOVER_08_DISPOSABLE_AUDIT_POSTGRES_PASS"
