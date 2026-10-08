# MONEY-FINISH.01–.04 — Merge and external repair queue
As-of main `b534a29f20f1a48aa69f28c03f73e14fd1323561`, 2026-10-08. This is a **snapshot**, not a declaration of what PRs are merged today. Refresh PR head SHA and CI before each step.

## Independent changes that are implemented in this code PR
- Inventory and merge-lineage validator + `MONEY-COMPONENT-TRUTH-MATRIX.json` (`.01`).
- Immutable paper ledger isolated-readback *parity* guard (`.02`). It can report `ORIGINAL_DATA_UNAVAILABLE` and never certifies that synthetic records came from the original RunPod volume. External restore proof is **blocked** until actually obtained.
- Core `paper-ledger.ts` rejects live-enabled, signable, fund-moving payloads and forged event IDs (`.03`). Pending Purse integrity repairs are not silently reimplemented.
- `MONEY-UPSTREAM-RIGHTS-REGISTRY.json` and strict read-only point-in-time source-admission gate (`.04`). License hints do not establish rights; the registry is intentionally **UNREVIEWED_DENY**.

## Safe source dependency order
1. **This FINISH P0 PR** is independent of open #1098/#1149/#1148/#1162/#1166/#1165; review exact-head CI and merge only after type-check, focused tests and complete Money Core regression pass. No new real trading, provider authorization, payouts or production runtime activation.
2. **SHADOW-REPAIR #1149**: reconcile grade source, early/mismatched horizons, source provenance; preserve invalid grades for audit. Read-only original Pod/volume discovery before any recovery attempt. Preserve the source rows, don't rewrite history. Repair merge conflicts on the exact current main.
3. **SHADOW-GDRIVE #1148**: verify machine OAuth, encrypted archive from actual persisted database/volume, isolated restore and independent readback. A synthetic canary ≠ original recovery. Never restart/create paid Pod without explicit owner authorization.
4. **PURSE integrity #1162**, then **stacked funding #1166**. Inspect P0 fixes, exact-head CI, owner-bank/wallet authorization, legal move-money modes and consumer-facing messaging. Payouts remain non-executing until separately authorized.
5. **SHARK ingress #1165** and **MARKET-IQ #1098**: review overlapping bridges, risk boundaries and tests; don't forward-port duplicate Money/Shadow models.
6. **MONEY-FINISH.05+** depends on licensed feed proof, approved durable worker and persistent storage; run separate subsequent code PRs.

## Current external blockers
- No independent RunPod original-network-volume readback or full user-data restoration was established in this task.
- SWLC/Supabase availability/repair not independently proved; do not claim migrations applied.
- Google Drive connected to ChatGPT ≠ machine identity or verified encrypted original-data restore.
- Vendor API license/terms, options quote-chain entitlement, and FINNHUB/Alpaca real read-only health are not commissioned here.
- Live provider permissions, USD/Phantom transfers, bank funding, trading and taxable events are out of scope.

## Acceptance receipts
`MONEY-FINISH P0 Contracts` CI workflow on exact PR head; original-store restore receipt only from independent persist/readback with matching hashes and row counts; Coffer/Purse separate financial-integrity PR tests; no merged PR treated as runtime proof without service telemetry.
