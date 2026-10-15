# BIZ-PURSE.01–.12 — governed completion and recovery record

## Audit snapshot — October 14, 2026 (America/Los_Angeles)

SWLC Supabase health: ACTIVE_HEALTHY. The canonical migration ledger includes Venture runtime migrations dated October 1 and some October 2 migrations, but NOT:
- `20261002190000_side_hustle_commercial_runtime.sql`
- `20261003143000_side_hustle_commerce_runtime.sql`
- `20261003181500_side_hustle_commissioning_evidence.sql`
- `20261003221000_side_hustle_digital_product_studio_registry.sql`

Five expected business tables and associated RPCs were absent at live readback. Their absence is not permission to hand-create divergent schemas.

`money_funding_rail_admissions` contains `funding:open` = `UNCOMMISSIONED`, `unassigned-funding-provider`, max single and daily movements zero. Queried SWLC had zero Coffer/charter/profit-sweep records and zero Side Hustle outcomes. PupsonStuff's connected database had zero orders. No live payment, order, trade, transfer, hosting, or settlement can be claimed from this audit.

## New isolated code-only additions

- `scripts/biz-purse-readonly-probe.sql`: passive inventory query, no DDL.
- `scripts/biz-purse-readiness.mjs`: fail-closed schema/migration/RLS/RPC presence gate.
- `packages/opportunity-core/src/domain/biz-purse-business-charter.ts`: versioned owner limits; internal zero-cost research assessed separately from Action Core authority.
- `packages/money-core/src/biz-purse-profit-waterfall.ts`: bigint settled-profit allocation proposals with owner entitlement first; no transaction submission.
- `scripts/biz-purse-release-gate.mjs`: dependencies and required receipts for all 12 milestones; NEVER returns financial or production authority.
- Corresponding unit tests.

These additions do not certify the commercial runtime, register a charter, configure a payment provider, or commission a host. No mutation of live Supabase was performed.

## Safe recovery steps for BIZ-PURSE.01

1. Inventory recorded migrations and live schema, check base SHA and identify dependent merged migrations between October 2 and October 3. Do not select only four files blindly.
2. Obtain verified *independently restorable* snapshot before schema mutation; record backup IDs, SHA-256, isolated restore and readback. If none is accessible, BLOCK.
3. Replay canonical migration chain against a disposable PostgreSQL environment, including RLS and RPC privilege/ownership tests. Check `SECURITY DEFINER` functions for owner authentication, fixed search paths, privilege revocation and lateral access. Reject mismatch.
4. Review SQL diff/plan and run Supabase security advisers; fix new critical findings. Do not broadly 'fix' unrelated existing RLS advisories by widening public access.
5. Only then apply reviewed canonical migrations via approved Supabase deployment and record versioned exact receipts. No new billable branch/project without prior cost approval.
6. Run `scripts/biz-purse-readonly-probe.sql` and save the single JSON output to `probe.json`; run `node scripts/biz-purse-readiness.mjs probe.json`. An all-green schema still requires authenticated user isolation, live API round trip and backup/restore certification.
7. Keep customer outreach, live funding, paid fulfillment and autonomous actions disabled until their separate milestone gates pass.

## Milestone state and owner-gated external dependencies

| Milestone | New work completed in this branch | Still required before claiming completion |
|---|---|---|
| 01 Schema recovery | Probe, status evaluation, negative tests | Exact historical replay, verified restore, applied canonical migrations, production readback and owner RLS |
| 02 Charter | Policy assessment and negative tests | Durable authenticated charter, Action Core integration, owner approval |
| 03 Scout | Existing Venture scouts reused conceptually | Real authorized data adapter, three real observations, evidence admission |
| 04 Client Capture Studio | Existing commercial work-order code discovered | Commissioned authenticated DB, customer scope and actual order |
| 05 Customer billing | Existing Commerce contracts available | Provider account, credentials, webhook signature, payment and refund replay |
| 06 Fulfillment | Existing Director/Growth/service receipts available | Real paid job, customer acceptance, error/restart reconciliation |
| 07 Purse funding | Existing Money-FUND protocols | Custody, funding provider, owner canary, settled receipt; current rail $0 |
| 08 Profit waterfall | Implemented proposal with owner priority and tests | Truth bridge, persistent accrual, legal/tax review, mandated bank sweep and live reconciliation |
| 09 Reinvestment | Existing Purse allocation/risk controls available | Approved budgeted provider permit and real spend reconciliation |
| 10 Multi-business | Existing 26-family registry and CRM | Two certified revenue loops with tenant and budget isolation |
| 11 Stocks, SHARK, Kalshi | Existing paper research; open dependent PRs | Forward paper evidence, independent settlement; separately governed venue canaries |
| 12 Unattended host | Release evidence contract | Funded or free compliant always-on host, fencing, restart drill, backup restore and real iPhone readback |

## Test commands

- `node --test scripts/biz-purse-*.test.mjs`
- `pnpm --filter @jhadina/opportunity-core test`
- `pnpm --filter @jhadina/money-core test:certification`
- `pnpm --filter @jhadina/money-core test`
- `pnpm --filter @jhadina/jhadina-web type-check`

## Financial invariant

Example proposed policy: 70% reinvestment, 20% owner share, 10% additional reserves of actual **distributable settled profit** after costs, refunds, tax provision and other prior accruals. A proposal does NOT set an owner mandate, create liability settlement, trigger a withdrawal, grant a trade permit, or authenticate a custody provider. Owner money remains legally owned and controllable by the owner. Reconciliation is essential; neither planned revenue nor paper trading gains can enter spendable cash.
