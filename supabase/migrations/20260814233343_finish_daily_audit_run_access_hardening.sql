-- Continuation of 20260812195157_harden_daily_audit_run_access.sql, split
-- out during Gate 10 (clean-replay ordering fix).
--
-- The two REVOKE EXECUTE statements below were originally part of that
-- migration. They target append_jhadina_evolution_run_ledger and
-- verify_jhadina_evolution_run_ledger, both of which are (in this
-- reconstructed canonical history) first created by
-- 20260814233342_create_jhadina_evolution_run_ledger_authoritative -- a
-- later migration. Moved here, verbatim, to run after that migration
-- exists.
--
-- No behavioral change from the live system: REVOKE is monotonic (it can
-- only remove privileges, never grant them), and 20260814233342 already
-- REVOKEs ALL on both functions from public/anon/authenticated before
-- GRANTing EXECUTE to service_role. These two narrower revokes are a
-- no-op confirmation of the same final state, not a new restriction.
--
-- See docs/JHADINA_SUPABASE_RECONCILIATION.md (Gate 10) for the full
-- rationale.

revoke execute on function public.append_jhadina_evolution_run_ledger(bigint,text,text,timestamptz,jsonb) from anon, authenticated;
revoke execute on function public.verify_jhadina_evolution_run_ledger(bigint) from anon, authenticated;
