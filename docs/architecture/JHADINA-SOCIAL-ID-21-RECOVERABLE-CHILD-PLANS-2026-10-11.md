# JHADINA SOCIAL-ID.21 — Recoverable child review plans and exact-dispatch preflight
**Date:** October 11, 2026
**Source parent:** PR #1214, commit `c8f97b6875fd727ddbccbe6b12fdcac01442e087`.
**Audit/repair:** [SOCIAL-ID.16 #1211](https://github.com/bookieandco/crispy-waddle/issues/1211) remains **BLOCKED_FOR_AUDIT_REPAIR**.

## What was coded

### 1. Recovery-safe transaction contract
`apps/jhadina-web/src/lib/social/durable-weekly-child-plans.ts` defines `AtomicWeeklyChildBatchStore` and `stageReviewedWeeklyChildBatch`.

The database adapter must perform **in one transaction**: (a) lock/re-read owner-scoped canonical packet and effective account identity revisions; (b) verify they still equal reviewed composite fingerprint; (c) lock/check currently approved, unused, unexpired owner-bound approval receipt including action ID/type/fingerprint; (d) create immutable reviewed batch and every child plan and consume the receipt atomically. Unique constraint per owner+packet and owner+receipt. If request response is lost *after* commit, identical retried request must return exactly the committed batch, while new receipt/fingerprint conflicts fail closed. Separate calls to `ApprovalReceiptStore.consume` then insert child rows are **not** a valid implementation.

The local tests use a simulated in-memory transactional fixture with response-loss injection. That is evidence of source algorithm behavior, NOT proof of actual database atomicity.

### 2. Recover/restore and preflight
`recoverReviewedWeeklyChildBatch` verifies authenticated owner, current packet and current identity revisions against the persisted batch before restoring all four kind-specific non-executable child review plans. It refuses stale revisions and untrusted/mutated JSON.

`preflightWeeklyChildAtDispatch` re-fetches current canonical packet+identity revisions and stored batch, verifies exact action fingerprint, returns only `REVALIDATED_ONLY`. It has `canExecute:false` and `requiresIndependentActionCorePermit:true`. The *eventual* real provider handler must call this at actual dispatch under an atomic/current-revision barrier and use the normal Action/Security per-action permit. It is NOT connected to transport and cannot itself publish, comment, spend or run Director jobs.

### 3. Explicit commissioning gate
`apps/jhadina-web/src/lib/social/supabase-weekly-child-batch-store.ts` adapts the contract to a single named Supabase RPC, but it is **hard disabled by default** via explicit `commissioned:false`. No route or worker instantiates it with true. A missing RPC or DB outage fails closed; no fake in-memory fallback. The required RPC **has not been created**, the canonical weekly-packet storage is not commissioned, and no SWLC SQL/DDL was executed.

### 4. Reapproval uniqueness repair
The existing `jhadina_social_approval_receipts` table has `UNIQUE(user_id, action_id)`. Reusing `social-weekly:<packetId>` made a changed packet/identity unable to request another receipt. `weeklyReviewReceiptActionId(packetId, compositeFingerprint)` now appends SHA-256 of exact reviewed composite; same revision is idempotent and changed proposals can be re-reviewed with different action IDs. Both the pending request and consumption checks use the exact same identifier. This does not grant any action authority.

## Tests
- Four child kinds persist as non-executable review plans, recovery after simulated restart.
- Commit succeeded + HTTP response lost → idempotent retry, no double receipt consumption.
- Changed identity, paid budget or evidence → stale plan refused before new staging or dispatch preflight.
- Foreign owner, missing session, fake action, corrupted persisted `canExecute` flag, database failure → refuse.
- Adapter commissioning gate, malformed JSONB and owner scope.
- Exact-head CI must be checked. No live provider, database schema, billing or shipping claim.

## Still blocking live completion
1. Repair SWLC DB connectivity and obtain a genuine independently-restored backup receipt, full migration inventory and row-level security review.
2. Commission canonical immutable owner-scoped weekly packet storage + effective identity readback and a *single SQL RPC* that atomically validates revised versions, one-time receipts, child batch write and retry recovery. Test concurrency and crash-after-commit on isolated DB.
3. Bind this revalidation inside actual Social/Growth/Director handler, enforce real Action/Security child permit and provider account rights, idempotent outbox reconciliation. Current helper intentionally has no dispatch.
4. Real phone owner session, two provider accounts, restarted sessions, receipt expiry/revocation and independent restore canaries.
5. Source PR stack (#1206–#1214 plus this PR) remains DRAFT/unmerged. Original Social Juggernaut #1136 is still divergent/unmerged; no silent merger.

**Completion status:** SOCIAL-ID.21 source contracts and offline tests may be certified by CI; live durable transaction and real dispatch certification remain blocked under issue #1211. Do not label .16 FINAL or .21 production complete.
