# SAM-SAFETY-LEDGER.08–.11 — source-only closeout and blocked production handoff

## Verified source inventory (.08)

The canonical SAM-oriented external authority/receipt families are enumerated in
`packages/opportunity-core/src/domain/sam-external-safety-audit.ts` as:
- Provider outreach — `provider-transport.ts` / `engagement-ledger.ts` model a separately approved single-send action and a returned external message reference. This is a **contract**, not proof of complete deployed transport capture.
- Federal bid/portal submission — `proposal-assembly.ts`; no independently verified bid-portal receipt feed.
- Contract signature/execution — `contract-readiness.ts`; no independently verified signature-event feed.
- Funds/payment — `award-execution-handoff.ts`; no independently verified processor/disbursement feed.
- Fallback or bypass — `action-executor.ts`; no independently verified network/transport bypass sensor or complete side-channel inventory.

An additional Action Core hash-chain domain-scoped observer was added in SAM-SAFETY-LEDGER.05–.07, but it cannot by itself prove the negative assertion that all external actions were authorized or all fallback paths are absent. SAM external receipt sources remain **uncommissioned**.

## Correlation engine (.09)

A pure, non-executing reconciler accepts external receipts, approvals, Action Core events and chain segments. It identifies:
- Completion with missing, mismatched, revoked, expired, reused or wrong-destination single-execution approval.
- Outbound completion with no matching completed Action Core event.
- Action Core completion with no external receipt.
- Independent provider/portal/signature/processor/fallback witness missing or inconsistent external reference.
- Missing receipt identity, duplicated IDs, inconsistent timestamps, orphan starts, unknown outcome of failed transport.

`observedUnauthorizedOperations` is a **lower-bound diagnostic count**, never a verified zero. The entire report has status `blocked`, `safetyEvidenceComplete:false`, and `authorizationGranted:false`.

## Gap detection (.10)

Checks contiguous sequence numbers, predecessor linkages, duplicate per-source segments, missing source segments and audit-window consistency. It **does not** verify cryptographic hash recomputation, trusted root ownership, source completeness, independent append-only attestations, all-user authorization scope, off-host backups or a transactionally sealed snapshot. A fixture with a perfect chain is still blocked: those external proofs must be obtained independently.

No new Supabase migration, RLS policy, generic gateway method, service key, live webhook, provider communication or signing/payment authority is added here.

## Adversarial CI (.11)

`sam-external-safety-audit.test.ts` covers no evidence, apparently clean fixture, expired/revoked/mismatched approval, reused authorization, provider witness mismatch, uncorrelated Action Core completion, orphan starts, failed sends, duplicate receipts, chain gaps, invalid windows and no false production PASS. The Opportunity Core existing CI test chain executes this suite. Live commissioning logs the static uncommissioned receipt roster without claiming the fixture was read from production.

## Bounded next actions (pending real platform/evidence)

1. Restore SWLC Postgres/REST availability (tracked in #1110) without destructive recovery.
2. Prove immutable writer/read permissions, complete action + external provider/portal/processor receipt feeds, independently sealed checkpoints and cross-actor/window coverage. Audit other canonical businesses' actions as relevant without granting new execution authority.
3. Add **read-only** and scoped feed connectors with authorization and idempotency correlation, then validate their completeness in an isolated environment.
4. Verify the production SAM OIDC gateway and safety observer against real recovered storage, and execute shadow/dry-run certification. All real sends, submissions, signatures and funds remain out of scope.
5. Review PR dependency chain #1336 -> #1337 -> this PR, rebase onto changing `main`, require exact-head CI and operator acceptance before merging.

**No live production safety certificate, client access, outreach, bids, money, purchases or deployments claimed.**
