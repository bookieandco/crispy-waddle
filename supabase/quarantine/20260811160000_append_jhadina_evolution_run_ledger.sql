-- ============================================================================
-- QUARANTINED — DO NOT APPLY. DO NOT MOVE BACK INTO supabase/migrations/.
-- ============================================================================
--
-- Reason: SUPERSEDED AND REPLAY-BREAKING (not dangerous to live data — this
-- is a structural/ordering hazard, distinct from the reason
-- 20260814000000_append_jhadina_audit_event.sql is quarantined).
--
-- This file was originally committed at
-- supabase/migrations/20260811160000_append_jhadina_evolution_run_ledger.sql
-- on the main branch. It is RPC-only: `create or replace function
-- public.append_jhadina_evolution_run_ledger(...)` with no accompanying
-- `create table public.jhadina_evolution_run_ledger`.
--
-- On the live project this was a redefinition applied against a table that
-- had already been created by an earlier, never-committed-to-git migration.
-- In this repo's git history, however, the table itself is only ever
-- created by 20260814233342_create_jhadina_evolution_run_ledger_authoritative
-- — a LATER timestamp. If this file were replayed in a clean environment in
-- timestamp order (as Supabase migration tooling does), it would run
-- *before* the table exists and fail outright:
--   ERROR: relation "public.jhadina_evolution_run_ledger" does not exist
--
-- Functionally, this file's `append_jhadina_evolution_run_ledger` body is
-- fully superseded by the one created in
-- 20260814233342_create_jhadina_evolution_run_ledger_authoritative (which
-- also creates the table, the append-only triggers, and
-- verify_jhadina_evolution_run_ledger). That later migration's version was
-- deliberately kept as the canonical filename/version for this function
-- (see docs/JHADINA_SUPABASE_RECONCILIATION.md — the PR #78 version/name
-- reconciliation), so this earlier RPC-only file is now dead weight that
-- would only break a fresh rebuild, never build on it in a live one.
--
-- Preserved here, unexecuted, for historical reference only.
--
-- Original filename/version: 20260811160000_append_jhadina_evolution_run_ledger.sql
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function public.append_jhadina_evolution_run_ledger(
  p_run_id bigint,
  p_task_id text,
  p_type text,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns public.jhadina_evolution_run_ledger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sequence integer;
  v_previous_hash text;
  v_event_id text;
  v_hash text;
  v_row public.jhadina_evolution_run_ledger;
begin
  if p_run_id is null or p_task_id is null or p_type is null or p_occurred_at is null or p_payload is null then
    raise exception 'ledger append requires run_id, task_id, type, occurred_at, and payload';
  end if;

  if p_type not in ('RUN_STARTED','RUN_DISPATCHED','RUN_VERIFIED','RUN_FAILED','RUN_BLOCKED','DRAFT_PR_CREATED') then
    raise exception 'invalid evolution ledger event type: %', p_type;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text, 0));

  select coalesce(max(sequence), 0) + 1,
         (array_agg(hash order by sequence desc))[1]
    into v_sequence, v_previous_hash
    from public.jhadina_evolution_run_ledger
   where run_id = p_run_id;

  v_event_id := p_run_id::text || ':' || v_sequence::text;
  v_hash := encode(
    digest(
      jsonb_build_object(
        'runId', p_run_id,
        'taskId', p_task_id,
        'type', p_type,
        'occurredAt', p_occurred_at,
        'payload', p_payload,
        'sequence', v_sequence,
        'eventId', v_event_id,
        'previousHash', v_previous_hash
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.jhadina_evolution_run_ledger
    (run_id, sequence, event_id, task_id, type, occurred_at, payload, previous_hash, hash)
  values
    (p_run_id, v_sequence, v_event_id, p_task_id, p_type, p_occurred_at, p_payload, v_previous_hash, v_hash)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.append_jhadina_evolution_run_ledger(bigint, text, text, timestamptz, jsonb) from public;
grant execute on function public.append_jhadina_evolution_run_ledger(bigint, text, text, timestamptz, jsonb) to service_role;
