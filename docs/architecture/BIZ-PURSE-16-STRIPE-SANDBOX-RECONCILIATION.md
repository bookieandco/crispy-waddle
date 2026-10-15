# BIZ-PURSE.16 — Stripe test-mode reconciliation, code-only

Status: **TEST-MODE CONTRACT AND READ-ONLY PROVIDER ADAPTER CODED; NO LIVE STRIPE OR SUPABASE COMMISSIONING.**

PR: https://github.com/bookieandco/crispy-waddle/pull/1275
Database repair: https://github.com/bookieandco/crispy-waddle/issues/1276

## Architecture

1. **Use the existing governed Stripe test-mode payment creation architecture**, not a new charging service: `apps/jhadina-web/src/lib/commerce/stripe-sandbox-provider.ts` and `production-payment-provider.ts`. Its existing test methods may issue Stripe test-mode PaymentIntents only after separately authorized governance.
2. **New incoming boundary**: `packages/opportunity-core/src/domain/biz-purse-stripe-sandbox.ts` provides `reviewRawStripeTestWebhook`, `verifyStripeTestWebhook`, `reviewStripeSandboxWebhook` and `createStripeTestReadOnlyPort`. It never charges, creates refunds, inserts journal rows, sends fulfillment, moves money or places bets/trades.
3. Signed payload admission verifies **raw request bytes** using Stripe's HMAC-SHA256 of `timestamp + '.' + rawBody`, constant-time digest comparisons, a 300-second maximum tolerance, a strict `Stripe-Signature` header, and one to three `whsec_` secrets for rotation. The payload is parsed only **after** signature validation; all `livemode:true` events are rejected. The safe combined entry point verifies signature before fetching anything.
4. Independently fetched test-mode Checkout Session and PaymentIntent must agree on the expected order, owner, customer, USD amount in minor units, paid/complete/succeeded states, connected payment IDs, and Stripe mode `livemode:false`. The read-only adapter accepts only `sk_test_` keys and GETs to `https://api.stripe.com/v1/` with strictly constrained IDs. No arbitrary URLs, POSTs or live secret keys.
5. For `refund.created` and `refund.updated`, separately retrieve the specified `re_` refund and require `succeeded`, a matching PaymentIntent, currency, test mode and bounded amount. Partial refunds remain **observations**: total refunded sums and replay/chargeback handling require the durable journal and independent provider reconciliation.
6. A signed event alone **never** establishes payment truth. The final result is `TEST_PAYMENT_OBSERVED` / `TEST_REFUND_OBSERVED` / `BLOCKED` / `IGNORED`, **always** with `canAppendJournal=false`, `canCharge=false`, `canRefund=false`, `canFulfill=false`, `canRecognizeCash=false`, `canPayOwner=false` and `canTrade=false`.

## Test commands

```bash
pnpm --filter @jhadina/opportunity-core type-check
pnpm --filter @jhadina/opportunity-core test
```

Tests: `biz-purse-stripe-sandbox.test.ts` covers authentic/tampered/stale/future HMAC, test/live rejection, rotation, unsupported events, order/customer/owner mismatch, unpaid/partial refunds, provider errors, sandbox-only read-only transport, raw-signature-first ordering, and webhook object confusion.

The code was locally exercised against injectable fixture transports, **not** a connected owner Stripe account. No `sk_test_`, `whsec_` secret, external webhook, checkout canary, or real provider readback was executed.

## Remaining commissioning gates

- **BIZ-PURSE.15 / Supabase DB-01..03**: finish verified SWLC backup/restore, migration collision reconciliation, and isolated Postgres journal race and two-user RLS tests. The journal is still disposable-only and does not accept writes from this .16 module.
- **Server authenticated order resolver**: retrieve expected binding from the owner's trusted order/tenant database after authenticating the service session; **never construct trusted owner/order references from webhook metadata**. Enforce dedupe by durable Stripe event ID and provider refund/intent ID.
- **Stripe owner test account**: securely connect the real owner-selected `sk_test_` key and distinct `whsec_` signing secret through a server-only secret store, run a genuine $0-risk Stripe test-mode checkout + signed webhook + independent GET + refund canary, and capture immutable receipts. No key may appear in Git, browser, Drive or logs.
- **Real webhook delivery and resilience**: authenticate raw bytes; handle eventual / out-of-order Stripe webhook delivery, repeat event IDs, backfill after downtime, delayed payment methods, partial refund sums, customer acceptance, and failed provider readback. Do not acknowledge events as processed before a durable commit exists.
- **Financial truth**: sandbox payment states must **never** enter realized-profit, Owner Payday, Purse transfers, automatic reinvestment, production order fulfillment or live commerce certification.
- **Separate production release**: no real-money mode, paid infrastructure, settlement inference or hosted endpoint before owner approvals, provider canaries, tax/reserve reviews and final independent commissioning.

## Reference documentation

- Stripe: https://docs.stripe.com/events/manage-webhook-endpoints (raw body signature checks, retries, event IDs)
- Stripe: https://docs.stripe.com/api/checkout/sessions/retrieve
- Stripe: https://docs.stripe.com/api/refunds/retrieve

Green fixture regressions verify the code's logic, not a completed Stripe external service integration.
