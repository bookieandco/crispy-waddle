# A5-R9 Live Migration Reconciliation

Status: AUDIT/REPAIR

## Scope

The connected Supabase production project `Swlc` was inspected on 2026-09-01.

The live migration history currently ends at the Director generation submission/fencing migrations. The A5 durable approval/replay migrations are not deployed there yet.

## Required deployment order

1. `20260901030000_harden_jhadina_audit_chain`
2. `20260901031000_idempotent_jhadina_audit_append`
3. `20260901032000_security_audit_decision_constraint`
4. `20260901040000_jhadina_commerce_payment_operations`
5. `20260901043000_jhadina_commerce_payment_operation_identity`
6. `20260901042000_harden_jhadina_audit_append_decision`

Before deployment, the migration ordering must be corrected so the timestamp sequence is monotonic. The 04:20 audit repair currently sorts before the 04:30 payment identity migration despite being created later. Rename/resequence only via a forward migration strategy; never rewrite migrations already recorded in production.

## Important production finding

Supabase security advisors report that `public.jhadina_research_source_performance_policy` has RLS disabled. Enabling RLS requires appropriate policies and must not be applied blindly.

## Verification gate

A5 is not production-closed until a clean database and the connected production schema both demonstrate:

- migration replay succeeds in chronological order;
- audit append accepts `allow`, `deny`, and `approval_required`;
- duplicate audit event retry is idempotent;
- content mismatch is rejected;
- audit-chain verification succeeds;
- payment operation identities distinguish charge/capture/refund;
- actor/action/capability/fingerprint binding cannot be substituted;
- durable nonce replay is rejected atomically;
- approval is consumed only at final execution;
- provider failure and terminal persistence failure are recoverable without duplicate irreversible execution.
