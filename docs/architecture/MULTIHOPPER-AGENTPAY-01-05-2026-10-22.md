# MULTIHOPPER-AGENTPAY.01–.05 — Read-only devnet integration and bounty qualification

Date: 2026-10-22

## Repository findings
- Canonical home: `packages/money-core` in `bookieandco/crispy-waddle`.
- Existing `wallet-connector-contracts.ts` separates the Phantom owner wallet from unattended Coffer execution and requires permit/allowlist checks for any separate execution adapter.
- Existing Purse and Coffer allocation/decision engines remain untouched. No second ledger, transfer execution engine, or wallet signer is created.
- No pre-existing MultiHopper module was found on main at the time of implementation.

## .01 — Sponsor / bounty due diligence
- Superteam listing: https://superteam.fun/earn/listing/multihopper-build-and-route-challenge-up-to-dollar50000-revenue-share-1/
- Sponsor challenge page: https://business.multihopper.com/build-and-route/
- API reference: https://multihopper.com/api-docs
- Developer access: https://business.multihopper.com/developers/
- Prize and revenue share are contingent. Confirm deadline and payout terms directly with sponsor before claiming eligibility.
- Specific discrepancy verified 2026-10-22: Superteam Earn listing requires at least **$100,000** of per-product qualifying production volume and describes volume-proportional winner awards; the MultiHopper sponsor page says **no minimum volume** and describes fixed winner shares **60% / 25% / 15%**. Superteam page still contains **draft** language conditioning the initial $5,000 on $2 million aggregate volume, whereas sponsor page calls that base pool guaranteed. Deadline is not shown as a confirmed calendar date (December 28, 2026 is an announcement date). Obtain written confirmation. **Do not manufacture routing volume.**

## .02 — Adapter
`multihopper-devnet-readonly.ts` implements only:
- `POST /api/v1/transfers/estimate` for non-mutating fee estimates;
- `GET /api/v1/transfers/:id` for observation; and
- `GET /api/v1/transfers/by-external/:externalId` for reconciliation.

It uses a fixed **devnet** HTTPS base URL, accepts only `mh_test_` credentials supplied at invocation time, does not store credentials, refuses responses explicitly marked production, and never exposes raw provider error bodies.

Not implemented: `POST /transfers`, `POST /:id/prepare`, signing, broadcast, `confirm-broadcast`, production routes, automatic payouts, or bounty submissions. Their addition requires a separately reviewed approval-gated adapter integrated with existing Money Core action/authority/permit and wallet boundaries.

## .03 — Test plan
Run `pnpm --filter @jhadina/money-core exec tsx --test src/multihopper-devnet-readonly.test.ts` from repo root; then `pnpm --filter @jhadina/money-core type-check`.
Cases cover:
- Deny live key / live-marked response; fixed devnet destination.
- Quote parsing, input validation, transfer observations.
- No create, prepare, sign or broadcast capability.
- HTTP failure message redaction.
- HMAC-SHA256 webhook verification on **original request bytes**, including unequal-length signatures.

All tests use injected responses. **Mock tests do not prove devnet API availability or successful real transfers.**

## .04 — Proposed iPhone product
Jhadina AgentPay will be a customer-facing payout draft and fee quote screen, not a custody product:
1. Human enters a legitimate invoice, verified payee wallet, token, raw amount, and business reason.
2. Money Core/Purse validates provenance, funds and payment authority; user sees quote and explicit cost.
3. Devnet fee estimate is labeled **simulation**.
4. Any later real transfer uses a separate user-approved signing and receipt flow, with idempotent invoice ID, provider state reconciliation and recipient allowlist.
5. iPhone mobile UI must avoid requesting seed phrases or storing wallet signing keys.

The branch includes a mobile-friendly **non-executable** `/money/agentpay` devnet quote preview and authenticated `/api/money/agentpay/quote` server endpoint. It is feature-flagged off by default, requires `MULTIHOPPER_DEVNET_READONLY_ENABLED=true` and a server-only `MULTIHOPPER_DEVNET_API_KEY=mh_test_...`, and is **not deployed**.

## .05 — Legitimate customer and submission acceptance
- Secure sponsor clarification on exact closing date, $50k pool mechanics, volume requirements, eligible cohorts, fee share, revenue-share term, attribution method, and what counts as qualifying volume.
- Acquire **independent genuine customers** with real business transactions; never self-route, wash-transfer, split artificial invoices, or generate circular volume.
- Require customer due diligence and jurisdiction-appropriate compliance/recordkeeping. Privacy routing does not eliminate integrator obligations.
- Verify onchain receipts, onchain fees and net economics, customer consent, cost of liquidity, failed/refunded transfer handling, and disputes.
- Capture a reproducible public demo, code tag, opt-in pilot cohort, adoption evidence and final Superteam submission before the verified deadline.
- Proceed to production, any wallet signing, spending, mainnet, or deployment **only on separate explicit authorization**.

## Current acceptance ledger
- .01 Sponsor/API references found; closing date and terms remain **UNVERIFIED**.
- .02 Read-only adapter committed for review; **not deployed**.
- .03 Mock tests authored; independent CI and live devnet evidence remain **UNVERIFIED** until results checked.
- .04 Preview-only iPhone-compatible UI **AUTHORED ON FEATURE BRANCH, NOT DEPLOYED**. Genuine customer pilot **NOT BUILT**.
- .05 Qualified usage and submission **NOT STARTED**.

## Prioritized next sequence
1. Run exact-head PR tests/CI and correct failures.
2. Obtain sponsor answer to rules; establish a real closing date.
3. Build preview-only mobile quote interface, identity binding, per-tenant boundaries and audit trail.
4. Test test-key devnet access and valid token fee quotes, then independently inspect evidence.
5. Recruit a first real business customer; authorize any production wiring separately.
