# RECOVERY-LINEAGE.FINAL

Status: certification candidate

## Frozen invariants

A Money recovery retry is a new governed execution, not a continuation of ambiguous provider I/O.

- The parent execution must exist and be recoverable.
- The latest canonical reconciliation observation must be `NOT_FOUND`.
- Reconciliation evidence must match execution ID, proposal hash, provider operation, and its deterministic evidence hash.
- Reconciliation itself never authorizes provider I/O.
- Every retry requires a fresh Action Core-bound, single-use Money execution permit.
- The recovery child is constructed from the persisted parent action snapshot, not caller-supplied economics.
- Every persisted snapshot must recompute to its recorded action fingerprint.
- Request, user, capability, provider, operation, accounts/payee/instrument, amount, and currency cannot drift.
- The retry permit must be consumed before the child is persisted and before provider I/O.
- Parent lineage is persisted with `recovery_of_execution_id`.
- Cycles are rejected.
- Recovery generations 1 through 3 are allowed; generation 4 is rejected.
- Provider ambiguity on a recovery child returns to UNKNOWN/recovery-required rather than being guessed successful or retried again automatically.
- Browser roles have no direct CRUD access to execution permits, attempts, connector execution ledger, or reconciliation evidence.

## Runtime evidence

Live rollback-only PostgreSQL probes verified:
- valid fresh consumed permit + latest NOT_FOUND reconciliation accepts a recovery child;
- unconsumed retry permits are rejected;
- stale NOT_FOUND evidence followed by PENDING is rejected;
- forged fingerprint/provider/operation/request lineage is rejected;
- non-recoverable parents and cycles are rejected;
- generation 3 is accepted and generation 4 is rejected;
- all synthetic records are rolled back.

Production drift discovered during certification was repaired fail-closed: the live permit table was missing the canonical Action Core binding columns from migration 005. The live table now requires `action_request_fingerprint` and `authority_id`.

## Source of truth

- `src/recovery-retry-evidence.ts`
- `src/postgres-recovery-retry-evidence-store.ts`
- `src/recovery-child-execution.ts`
- `src/recovery-child-executor.ts`
- `migrations/005_bind_permits_to_action_core_authority.sql`
- `migrations/006_recovery_execution_lineage.sql`

Final certification requires the Money R13B GitHub Actions workflow to pass on this branch.
