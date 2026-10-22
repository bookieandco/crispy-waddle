# JH-PURSE-SELF-FUND.RECOVER.04–.06 — Source-only recovery and commissioning handoff

## Scope and lineage
- Base PR: **#1456** (`.01–.03`), pinned ancestor `65254aa095d958d12b468879dceaa91091523340`.
- Donor BIZ-PURSE #1275 remained an unmerged 103-file, nonmergeable draft. Only its *isolated* Stripe TEST verifier and adversarial tests were forward-ported verbatim, not its stale schema or entire business service stack.
- Canonical Commerce creates governed payment intents; canonical Side Hustle/Opportunity owns work orders, delivery and accepted outcomes; canonical Money/Coffer alone owns custody and executable movements.
- No new Stripe pay or refund handler, wallet signer, second payment database, independent order journal, income crediting executor or business agent is introduced.

## .04 — Stripe TEST evidence with independent readback
- `packages/opportunity-core/src/domain/biz-purse-stripe-sandbox.ts`: donor verifier for raw-byte HMAC signature, 300s timestamp window, test/live enforcement, session + PaymentIntent + refund independent GET, owner/order/customer/amount bindings, strict `sk_test_` GET-only allowlist, replay identity and exception handling.
- `biz-purse-stripe-sandbox.test.ts`: tampered signatures, replay/expired timestamps, live-mode contamination, mismatched objects and missing confirmations tested.
- The return type is **TEST_PAYMENT_OBSERVED / TEST_REFUND_OBSERVED** only. It always returns `canRecognizeCash=false`, `canAppendJournal=false` and `canPayOwner=false`. A signed event is not settlement, and a test payment is never income.
- **External blockers:** no owner-connected Stripe TEST `sk_test_` / `whsec_` credentials were configured, no real test checkout/webhook/readback/refund was dispatched. Do not receive test secrets in GitHub or logs. Existing Action Core governance must approve any later test payment.

## .05 — owner-authenticated mobile Purse
- `/money/purse` linked from Money Command Center. Authenticated GET `/api/money/purse/self-funding` calls existing `readSessionMoneyWorkspace()`, never trusts owner ID from URL/headers/body.
- Current user Coffer and owner sweep state come from canonical Money.
- Fixed allowlist of five commercial tables probed using server-only, metadata-light read-only HEAD requests; queryability is reported as **not certified**, never proof of RLS or independently restored migrations.
- Earnings, operating costs, provider fees, tax provisions, distributable profit, payout and runway all remain `null` (shown as **Not evidenced**) until the owner-authorized, independently reconciled Money revenue pipeline is live. No dashboards substituting `0` for missing observations.
- The route returns only status, fixed table names, coffer reserve floors, and whether an owner destination is configured. No address, identity, keys, or customer records are returned.

## .06 — first-client business cycle contract
- `purse-first-business-cycle.ts`: nonposting evidence review of canonical accepted work order, delivered artifact, linked customer acceptance, owner-bound provider settlement claims, distinct payout and Money custody readback, chronology, quoted price, currency, and explicit direct costs, fees, taxes and operating reserve.
- No artificial paid outcome or simulated profits. Even a fully linked evidence packet can only reach **INDEPENDENT_REVIEW_REQUIRED** and cannot post money, recognize profit, fulfill, pay the owner or execute.
- Unit fixtures represent synthetic AI service price ($99) ONLY, not a customer payment. Safe to reuse for a PupsonStuff digital portrait after production prerequisites.

## Production reality / required next steps
Read-only Supabase checks on 2026-10-22 UTC: Postgres responds and is no longer read-only, but the five commercial tables remain missing. The funding rail was earlier observed `UNCOMMISSIONED` with zero limits, and no Coffer, charter, sweep or movement records were observed. These are **observations**, not external custody proof.

To finish live commissioning, in this order:
1. Owner-approved genuine backup of historical source, independent isolated restore and readback; reconcile migration versions, disposable replay and RLS cross-user checks before any approved production DDL.
2. Use canonical Commerce with owner-approved Stripe TEST account. Run signed checkout → independent GET → refund → durable journal readback under an authenticated owner session; certify separate test/live boundaries.
3. Create one legitimate, appropriately consented customer work order using canonical Side Hustle or PupsonStuff, fulfill it, and independently verify acceptance.
4. Obtain real processor settlement and separate Money custody credit, reconcile costs/refunds/taxes/reserves and only then recognize earnings via the original Money owner-approved control plane.
5. Validate owner iPhone display after deployment; no public widening, autonomous purchases, transfers or trades from this PR.

Review exact-head typechecks, focused tests, web build and mainline diff. Keep this PR draft until all software checks pass and external blockers are independently resolved.
