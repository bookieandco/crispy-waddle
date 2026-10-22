# JH-PURSE-SELF-FUND.LIVE.07–.10 — evidence-only recovery (2026-10-21 PDT)

## Baseline
- Stacked on source-only [PR #1460](https://github.com/bookieandco/crispy-waddle/pull/1460), head `a00571ec395e6b058cef918de2c923038a591832`, which itself depends on draft [PR #1456](https://github.com/bookieandco/crispy-waddle/pull/1456).
- GitHub main `04e96506f78ad16d7cd2d4a5fdb98c5c437c0a61` was checked unchanged before branching.
- Latest connected Jhadina Supabase SQL audit at 2026-10-22 05:19 UTC showed Postgres online, `transaction_read_only=off`, five canonical commercial tables absent, zero `money_coffers` and zero `money_movement_attempts`. These observations cannot certify backup or live custody.
- No Stripe TEST credential, refund provider readback, actual signed webhook, settled client receipt, independently restored backup, or iPhone acceptance receipt was provided. Therefore none are claimed completed.

## Upstream agent-bank research
Upstream: [different-ai/agent-bank](https://github.com/different-ai/agent-bank), pinned commit `edf977fb0a315728ca1bf247f70249d838b01519` (2026-04-03), MIT LICENSE. CLI module `packages/cli` calls `/api/cli/invoices`, `/api/cli/bank-transfers/proposals`, `/api/cli/bank-accounts` with a bearer token. Its README advertises invoice creation, transfer proposals with approval, receipt matching and banking; self-hosting and real custody require additional credentials/services. The README links to a `LITE_MODE.md` that is *missing* from this pinned repository; do not infer a turnkey self-hosted bank.
- Preserve Jhadina's canonical Coffer, Money Core, Commerce, Action Core and Side Hustle ledger; do not introduce an unlicensed bank, another signer, a second accounting engine or shadow custody.
- Reuse patterns **only**: nonexecuting invoice proposals, owner-approved transfer *proposals*, provider readback, receipt reconciliation and funding status, with source attribution.
- `reviewAgentBankReferenceObservation` admits an allowlisted, untrusted research observation and always yields `recognizedRevenueMinor:null` and all money/commerce authority **false**. No external API call, credential, onboarding, ACH, IBAN, invoice transmission or signing is performed; no CLI bootstrap script is run.

## .07 — independent database restore gate
`reviewLive07Restore` checks all five canonical table names, source/isolated restore receipts and matching 64-character snapshot digests, exact migration version list, cross-user RLS negative canary and replay evidence. It ALWAYS retains external-witness and explicit owner DDL approval holds. Software cannot independently attest a recovery performed elsewhere.
Actual independent backup/restore and database migration remain BLOCKED. No SQL migration was executed, no Supabase branch created, no new storage or charges.

## .08 — Stripe TEST canary gate
`reviewLive08StripeTest` inventories signed webhook, Checkout Session + PaymentIntent provider readbacks, refund and durable journal. It NEVER substitutes this metadata for the *actual* HMAC and independent provider GET verifications already in `biz-purse-stripe-sandbox.ts` from PR #1460. Real owner-connected test-mode credentials and a refund canary are missing, so external certification is BLOCKED. `sk_live_` is never admitted by the existing TEST port.

## .09 — owner iPhone acceptance gate
`reviewLive09Iphone` checks test claims for authenticated iPhone Safari portrait mode, four actionable routes, unauthorized-session denial, logout and real owner session. It ALWAYS needs independent actual-device witness and does not assert Jhadina is usable on this device yet. `/money/purse` shows static next-gate panels on mobile; no provider controls can be triggered from them.

## .10 — one real customer pilot gate
`reviewLive10Pilot` requires owner authorization, customer consent, canonical work order, delivery, acceptance, real-money price/mode, provider settlement, independent Money custody readback and cost/tax review. Claimed values cannot certify real revenue or permit owner payday. All real client messaging, checkout, fulfillment, payment and owner payout remain separately approval-gated.
The first actual customer and Stripe LIVE account have **not** been onboarded and no real payment or refund has been created.

## Validation
```
node --test scripts/purse-live-07-10-gates.test.mjs
pnpm --filter @jhadina/opportunity-core type-check
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/jhadina-web type-check
```
Review the **exact final PR head** in CI, then merge the dependency chain only after code approval. Do not mistake a PASS build for external payment, restored database or iPhone acceptance.

## Next external commissioning order
1. Independent source backup → isolated restore → migration collision resolution, isolated replay and two-user RLS evidence → separately approved production migration.
2. Owner connects Stripe TEST privately (never through repository or chat); run real signed checkout/refund/webhook/reconciliation canary in canonical Commerce.
3. Validate owner's actual iPhone and sign-in/session/logout in protected preview.
4. Owner approves one legitimate customer offer, fulfillment and a separate real payment pilot; match processor settlement and bank custody before recognizing income.
5. Only after all of these may Money Core evaluate a bounded real payout proposal with separate owner authorization.
