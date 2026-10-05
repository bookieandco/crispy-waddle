-- SUPABASE-DB.2 read-only post-recovery audit.
-- Run only after direct SQL is accepting connections.
-- No DDL, VACUUM, DELETE, UPDATE, INSERT, or server-file inspection.

select
  now() as observed_at,
  current_database() as database_name,
  current_setting('server_version') as server_version,
  pg_is_in_recovery() as in_recovery;

select
  pg_database_size(current_database()) as database_bytes,
  pg_size_pretty(pg_database_size(current_database())) as database_size_pretty;

select
  schemaname,
  relname,
  pg_total_relation_size(relid) as total_bytes,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size_pretty,
  n_live_tup,
  n_dead_tup,
  last_autovacuum,
  last_autoanalyze
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc
limit 50;

select
  slot_name,
  slot_type,
  active,
  database,
  restart_lsn,
  confirmed_flush_lsn
from pg_replication_slots
order by slot_name;

select
  pid,
  usename,
  application_name,
  client_addr,
  state,
  wait_event_type,
  wait_event,
  xact_start,
  query_start,
  left(query, 240) as query_sample
from pg_stat_activity
where pid <> pg_backend_pid()
  and (
    xact_start is not null
    or state is distinct from 'idle'
  )
order by coalesce(xact_start, query_start) asc
limit 100;

select
  count(*) filter (where state = 'active') as active_connections,
  count(*) filter (where state = 'idle in transaction') as idle_in_transaction,
  count(*) as total_connections
from pg_stat_activity;

select
  extname,
  extversion
from pg_extension
order by extname;
