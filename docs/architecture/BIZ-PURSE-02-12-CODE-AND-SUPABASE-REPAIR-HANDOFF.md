# BIZ-PURSE.02–.12 code-only execution and Supabase audit/repair handoff

As of October 14, 2026 PDT, separate `SOFTWARE IMPLEMENTED`, `EVIDENCE GATE READY`, `SUPABASE AUDIT/REPAIR`, and `REAL SERVICE COMMISSIONED`. Do **not** treat them as synonyms.

## Actual branch and live state

- Code PR: https://github.com/bookieandco/crispy-waddle/pull/1275 (draft; code-only).
- Supabase repair issue: https://github.com/bookieandco/crispy-waddle/issues/1276
- SWLC `kqbkaozfjubkjevdfvic`: at 2026-10-15 02:03Z, all five canonical Side Hustle commercial tables were absent, `money_coffers` count 0, `money_profit_sweep_policies` count 0, funding rail `funding:open` = `UNCOMMISSIONED`, max movement 0.
- Live Supabase was queried read-only; **no migration, seed, financial transaction, account or worker was created**.
- External payments, live order fulfillment, owner payout, DEX/stock/Kalshi/sports wagering and paid worker operations still blocked.

## New code surfaces and milestone mapping

| Milestone | Code-only contribution | External/Supabase acceptance blockers |
|---|---|---|
| .02 | `biz-purse-business-charter.ts` assesses bounded owner-approved zero-cost research versus Action Core required external actions; no self escalation. | DB-04 charter authentication/persistence and owner attestation |
| .03 | `biz-purse-commercial-gates.ts` checks timestamped independent scout evidence. `biz-purse-deerflow-research.ts` offers a separate optional read-only gateway result assessment. | DB-05 canonical scout storage, real verified sources, infrastructure/cost approval for any external harness |
| .04 | `biz-purse-client-capture.ts` productizes existing commercial service work orders: $99 audit, $299 setup, $149/mo management (**suggested pricing**, not sales). | DB-01/02/03/06 commercial tables and real owner/customer records |
| .05 | `assessCommercialPayment` rejects unsettled, stale, unsigned, mismatched, test and independently unverified provider events. | DB-07 payment processor owner account, webhook signing, settlement, refunds and duplicates |
| .06 | `assessCommercialDelivery` requires accepted work order, matching owner and independent delivery/acceptance receipts. | DB-06 real paid work order, tenant isolation, customer acceptance and worker QA |
| .07 | `assessOwnerSeedFunding` requires matching owner, commissioned rail and independently reconciled custody. | DB-08 SWLC funding currently UNCOMMISSIONED and $0 |
| .08 | `biz-purse-profit-waterfall.ts` computes owner 20%, reinvestment 70%, retained reserve 10% *as a proposed owner policy*, using bigint, settled after-cost revenue and liquidity floor. | DB-09 legally reviewed policy, real accounting bridge and owner payout verification |
| .09 | `assessBusinessReinvestment` rejects underfunded owner share, overspending and non-owner operating caps. | DB-10 persistent spend reservations and Action Core single-use permits |
| .10 | `assessMultiBusinessIsolation` rejects duplicated business/customer/ledger IDs, cross-owner account access and aggregated overspend. | DB-11 demonstrate two independently operating commercial ventures |
| .11 | `assessPaperMarketResearch` checks forward paper outcomes, feed freshness, data gaps and independent settlement receipts. Always canTrade=false. | Venue-specific paper runtime, market source recovery, separate real-money approvals and custody never inherited from this assessment |
| .12 | `assessUnattendedHost` checks pinned SHA, lease fence, durable receipts, verified independent restore, phone readback and cost. `GET /api/opportunities/biz-purse/readiness` is authenticated, read-only, no-store and reports commercial schema only. | DB-12 worker deployment and controlled multi-day restart testing; no hosting purchases authorized |

## DeerFlow repository research (user-proposed option)

Source: https://github.com/bytedance/deer-flow, reviewed Oct 14 PDT, branch main commit `a6b35523628747aa353d4d80804106f783f08115`. Repository is MIT licensed with copyright notices to retain. Current README describes **DeerFlow 2.0 as a distinct Python agent harness** with subagents, memory, sandbox, skills, gateway and scheduled tasks; it is not the old 1.x framework. Security notice warns gateway admin access is effectively shell-code execution and recommends loopback trusted deployment; do NOT expose an unisolated gateway to the public internet. Suggested 8 vCPU/16 GB RAM and 40 GB storage for long-running server are not compatible with assuming a free lightweight always-on host. Any hosted LLM bills/permissions must be verified independently.

Decision: **OPTIONAL RESEARCH ADAPTER, OFF BY DEFAULT**. Do not clone or deploy DeerFlow automatically, do not send Jhadina Supabase service-role keys, bank, trading, payments, or customer credentials to it, and do not let DeerFlow control Purse, Action Core, market execution, customer contacts or publishing. Jhadina remains the system of record and authority; any research results are untrusted until external provenance verification. The research boundary returns `UNTRUSTED_RESEARCH_IMPORT_ONLY`, never financial or production authority.

Integration sequence if later approved:
1. Pin upstream source SHA and exact MIT license/notice; record dependency/security advisory review.
2. Run within an isolated sandbox with *no* shell/stdio MCP admin, file writes, public gateway or financial secrets.
3. Admit only source-linked research via `assessDeerFlowResearch`; store original result separate from confirmed observed facts and keep prompt injection from becoming instructions.
4. Prove cost limits, stop button, tenant isolation and independent results. Any later runtime requires an explicit operator-governed host, not an implied $0 cloud entitlement.

## Supabase audit repair / release holds

All Supabase-dependent work stays marked **AUDIT/REPAIR** in issue #1276: canonical migration chain, verified backup/restore, RLS/RPC grants and tenant isolation, charter persistence, scout provenance, commercial order and receipt tables, payment journal, treasury and owner entitlement, spend reservations, multi-business scopes, host leases and mobile readback. Do not bypass by creating placeholder data or marking synthetic tests as live.

## Validation commands (exact branch)

```bash
node --test scripts/biz-purse-*.test.mjs
pnpm --filter @jhadina/opportunity-core type-check
pnpm --filter @jhadina/opportunity-core test
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core test
pnpm --filter @jhadina/jhadina-web exec tsc --noEmit -p tsconfig.opportunity.json
```

A green CI proves software contracts only. It is not a connected payment, backup restore, Supabase migration, business launch, all-day paper study or trading authorization.
