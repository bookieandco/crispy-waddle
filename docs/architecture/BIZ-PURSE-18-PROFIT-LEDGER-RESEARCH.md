# BIZ-PURSE.18 — Research-only Profit Ledger

## Status: code implemented, external commissioning blocked

Draft PR: https://github.com/bookieandco/crispy-waddle/pull/1275
Supabase dependency/repair tracker: https://github.com/bookieandco/crispy-waddle/issues/1276

This milestone creates a deterministic read-only **accounting research projection**, not a bank ledger, payable owner account, broker funding authority, or executor.

### Accounting inputs and the boundary

`packages/money-core/src/biz-purse-profit-ledger.ts` projects a period-scoped stream of events for one owner, business, currency, and accounting period:

- Customer settlement candidate, payment-bound refund, and chargeback
- Provider fee, direct cost, tax/obligation provision, and previously allocated profit
- Original owner seed capital and uncollected order (both **excluded from revenue**)
- Current settled cash and other reserved cash readbacks (required before producing even a provisional waterfall)

`mode` is **LIVE_UNCOMMISSIONED**, **STRIPE_TEST**, or **SYNTHETIC**. Test/synthetic evidence is quarantined and can never enter even a provisional distribution proposal. Events with no claimed independent readback are quarantined. The returned accounting numbers labelled candidate are **not verified settled cash**, since caller-provided readback claims cannot independently certify Stripe, bank custody, legal eligibility or owner mandate.

The reducer requires monotonically ordered sequence numbers, tenant/period/currency matching, distinct evidence IDs, exact idempotent replay of the same event, unique provider event IDs and settlement IDs, and bound per-payment reversals. A reversal cannot exceed the original recognized payment. Events from an unmatched owner/business/period are refused. Cash/readback receipts must be current enough, and missing cash snapshots block the proposal.

**Owner principal protection:** total seed funding is added to reserved cash before invoking `proposeBusinessProfitWaterfall`; principal can never be considered free cash for suggested distributions or reinvestment. A dedicated regression checks that a positive cash balance composed of owner seed produces zero owner funding and zero reinvestment. This is conservative until independently proven capital withdrawals/reconciliations exist.

### Allocation proposal

Reuses the existing `biz-purse-profit-waterfall.ts` for the indicative 70% reinvest / 20% protected owner / 10% retained reserve arithmetic. A reversal after prior allocations produces an accounting deficit with zero new allocation. No split is an effective disbursement policy until owner review/approval and tax provisioning are independently confirmed.

The entire module exports `authority='ACCOUNTING_RESEARCH_ONLY'`, `providerSettlementCertified=false`, `ownerEntitlementPayable=false`, `reinvestmentAuthorized=false`, `canPostJournal=false`, `canMoveMoney=false`, `canTrade=false`. The waterfall itself also returns `canMoveMoney=false`, `canPlaceOrders=false`.

### Verification

```bash
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core exec tsx --test src/biz-purse-profit-ledger.test.ts
pnpm --filter @jhadina/money-core test
```

The targeted tests are wired into `.github/workflows/opportunity-core-ci.yml`. They cover verified-looking claimed receipts versus test-mode observations; seed capital and unsettled orders never counted as revenue; owner-principal cash protection; fees/taxes/costs; refund and chargeback reversal; prior profit allocations; source duplication and exact replay; tenant mismatches, sequence gaps, cash readback freshness and missing liquidity. Passing tests certify the projection only, **not real accounting records**.

### What still needs commissioning before any live functionality

1. SWLC restore/migration collision repair (#1276, DB-01–03), source/remote parity, RLS and two-user readback.
2. Durable append-only accounting event and payment-refund uniqueness scoped across **all periods and businesses**, with event/readback digests, stream-head concurrency/fencing and immutable evidence. Cross-period deduplication is a **database constraint**, not assured by this one-period projector.
3. Server-side owner and provider transaction identity obtained from trusted session/custody/provider APIs, not webhook metadata or model assertions. Genuine Stripe/payment settlement verified outside the reducer; no test or synthetic evidence promotion.
4. Coffer account and owner seed liability accounting: independently reconcile principal deposited/returned, cash location, operating reserves, fees, tax obligations, chargebacks, prior owner payments and reversal debt. Prevent double-use of cash across businesses or periods.
5. Owner-approved policy and payout destination, entitlement journal and verified payability before any actual transfer. Pending owner share must remain protected.
6. Reinvestment requires atomic spend-reservation/cap controls, owner charter, budgets, free/approved platform cost, verified operator authority, and emergency stop. Trading remains in a separate venue-specific commissioning lane.
7. Separate approved sandbox and live commercial canaries, with independent auditing and multi-day restart/restore.

**Nothing in this milestone sends funds, initiates a purchase, grants payment authorization, places wagers/trades, creates Supabase tables, or processes a live Stripe event.**
