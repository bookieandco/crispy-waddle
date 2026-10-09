# Product naming decision — Purse is the treasury; SHADOW owns paper research

Date: 2026-10-09 UTC. User clarified: “change the name from Coffee [Coffer] to purse” and the recent “Purse” work in the chat is actually Money Core / SHARK / SHADOW paper-trade infrastructure.

## Canonical product terms

| Public product name | Responsibility | Legacy implementation retained |
|---|---|---|
| **Jhadina's Purse** | Real-money treasury, owner-protected capital, fiat/crypto custody, funding, principal/reserve/survival floors, realized profits and owner sweeps | `CofferPolicy`, `money_coffers`, `money_coffer_*`, Coffer signer and accounting engine |
| **Money Core** | Capital/risk governance, live trading mandates, account entitlements, permits, provider execution, canary, kill switch, reconciliation | Existing canonical Money Core. Never build another executor under Purse |
| **SHARK** | Market intelligence, hypotheses, MIMS, trading opportunities and signal assessment | Existing SHARK-to-Money evidence bridge |
| **SHADOW** | Historical and forward-only paper-trade simulation, fake-fill testing, out-of-sample horizon grading, learning, watchdogs, synthetic integration tests and recovery | Code previously developed as `purse-paper-autonomy`, `purse-shadow-evidence-admission`, `purse-commission-paper-runtime`, `money_purse_paper_*` |

## Operator / phone routes

- `/money/purse` is now real-money Purse: owner controls, deposits, withdrawals, reserve/treasury governance and links to Money Core.
- `/money/shadow` is SHADOW paper lab, with evidence statuses and paper-cycle history.
- `/api/money/shadow/status` aliases the legacy read-only `/api/money/purse/status` endpoint. The old route is retained for clients and reports. **Do not use this endpoint as a live Purse balance or funding certification source.**
- `/money/command-center` displays Purse capital and directs to both Purse and SHADOW.
- `/money/commissioning` configures Purse owner treasury policies, **not** a simulation mandate.
- `/money/funding` uses Purse in labels but retains legacy `coffer:` endpoint IDs; changing IDs would orphan approvals and break idempotency signatures.

## Backward-compatible source names

- `packages/money-core/src/purse-treasury-public-api.ts` exports the **same** Coffer treasury/accountant functions as Purse names. No duplicate treasury or extra authorization path.
- `packages/money-core/src/money-shadow-paper-public-api.ts` exports the original Purse-paper functions as SHADOW aliases. No copy of ledger, state, recovered data or live finance authority.
- Prior historical PRs #1162, #1166, #1186 and #1188 keep their IDs and logs. The work represented by their paper-cycle, SHADOW-grade and CI sections is **SHADOW / Money Core paper learning**, not the treasury brand.
- Legacy SQL migrations, JSON keys, table names, provider identifiers, wallet roles, PnL lineage, `cofferId`/ `money_coffers` and signer leases remain unchanged for database compatibility. A future atomic, independently validated schema/API migration may relabel persistence **only** after SWLC is healthy, all original history has been inventoried and provider integrations have explicit backward mapping.

## Real-money end state

Purse must eventually be able to hold and grow *actual* owner-approved funds. Execution stays downstream:
`SHARK -> Money opportunity -> Purse capital allocation -> Money autonomous risk -> Action Core authorized mandate -> single-use permit -> broker/isolated DEX executor -> actual settlement -> Purse accountant/owner payout.`

A paper-trained strategy **never** automatically gains live authority. Live requires a separately approved, bounded standing mandate, funded owner-controlled custody, licensed provider, verified data and healthy durable storage; account/wallet connections alone are not funding or signed ownership proof. Profit sweeps stay owner-protected and cannot be redirected by model autonomy.

## Operations and historical recovery

- SWLC/Supabase PostgreSQL last read returned 57P03, previously linked to disk exhaustion and crash recovery. No production storage readiness has been certified.
- Original SHADOW historical ledger remains unrecovered. `NEW_FORWARD_ONLY` is a separate paper dataset; tests must never synthesize historic trade outcomes.
- Google Drive synthetic canaries do not prove backup of original actual ledger or runtime worker OAuth. Portable Postgres CI does not certify production wallet/account/provider readiness.

## Follow-up without breaking existing code

1. Source branch naming and owner terminology tests must pass exact-head CI.
2. Review/merge existing PR chain #1162 -> #1166 -> #1186 -> #1188, then the naming PR based on #1188; preserve migrations and ledger compatibility.
3. Once SWLC recovers, verify real Coffer-backed Purse balances and owner policy with legacy data binding; never rename storage before readback.
4. SHADOW/SHARK workers and receipts should use public aliases for new code. Migration of internal identifier text is deliberately **not** a prerequisite for live Purse commissioning.
5. External provider commissioning and live trade authority remain separate evidence requirements with explicit owner approval.
