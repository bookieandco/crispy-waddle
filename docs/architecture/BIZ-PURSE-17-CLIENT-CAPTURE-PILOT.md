# BIZ-PURSE.17 — Client Capture Studio Pilot
**Status:** code-only synthetic rehearsal. Not a paid business, live customer, production payment, deployed worker, or customer acceptance.

**Tracking:** [Draft PR #1275](https://github.com/bookieandco/crispy-waddle/pull/1275) · [Supabase audit/repair #1276](https://github.com/bookieandco/crispy-waddle/issues/1276)

## Reused canonical code
- `biz-purse-client-capture.ts`: productized `AUDIT` quote, $99 indicative price; no payment request.
- `side-hustle-commercial.ts`: canonical work-order creation, scope lock, registered executor check, delivery start/receipt, and simulated acceptance or revision.
- `biz-purse-client-capture-pilot.ts`: pure deterministic synthetic observation audit, findings, and rehearsal adapter. No API/DB/provider calls.
- `biz-purse-client-capture-pilot.test.ts`: synthetic end-to-end and negative cases.

## Synthetic intake / audit contract
A caller supplies a canonical `business_automation` Opportunity in `approved`, `ready`, or `pursuing` state, synthetic owner/customer/work-order references, explicit `SYNTHETIC_REHEARSAL_ONLY` mode, confirmed synthetic fixture, observation window and first-response target. Events carry non-identifying `case:<id>` keys, timestamps, and `fixture:<id>` evidence references. No customer emails, names, phone numbers, free-form messages, addresses, or CRM snapshots are accepted.

The deterministic audit counts inquiries, first responses, on-target responses, completed handoffs, and outstanding exceptions. It identifies:
- responses later than the target,
- inquiries with no response,
- qualified cases with no handoff,
- exceptions requiring manual attention,
- samples with fewer than 3 inquiries.

These are **synthetic fixture observations**, not invented improvements, verified lead conversions, or proven client demand. The report hashes scoped input and includes source/evidence references. No deployed AI model or external CRM connector has been commissioned. The proposed improvements are recommendations, not instructions to contact customers.

## Simulated lifecycle
The rehearsal creates a canonical commercial work order from the existing productized offer, locks scope, starts a registered execution-owner task, attaches the simulated report and records a simulated customer acceptance/revision. The returned **external** result contains only trace statuses and fixture receipt IDs, never the raw canonical accepted work order/receipt. Its fixed authority is `INTERNAL_PILOT_EVIDENCE_ONLY`, and all flags for charging, real delivery, real customer acceptance, revenue, publication, and funds remain false. `SIMULATED_ACCEPTANCE` is not an accepted real customer job.

## Verification
```bash
pnpm --filter @jhadina/opportunity-core type-check
pnpm --filter @jhadina/opportunity-core test
```
The added package test must verify arithmetic, canonical lifecycle states, revision, no customer response, chronology, duplicate evidence, a bounded synthetic observation window, and failure when real mode is requested. Exact-head GitHub Actions run must pass before marking the **code-only** milestone done.

## Still required for real client pilot
1. **Supabase #1276**: independently restorable backup, migration historical reconciliation, verified local replay + owner RLS; canonical work order and receipt tables with tenant isolation. No blind production changes.
2. **Authenticated client intake**: explicit client authority/consent and privacy retention policy, real source evidence with freshness, PII handling, a scoped customer record and auditable work order. Keep synthetic and live data in separate stores/identities.
3. **AI audit generator review**: approved model/vendor, measurable source provenance, hallucination/contradiction checks, QA thresholds and documented human exception handling. The current module is deterministic, not an LLM.
4. **Stripe sandbox #16**: owner-controlled test key, signed webhook, independently fetched payment status, order binding, idempotency, refund and test-only delivery rehearsal before separately approving a real transaction.
5. **Customer fulfillment**: delivery address/channel consent, customer acceptance authenticated outside a model-generated statement, revision workflow, corrections, redaction and client-support route.
6. **Business outcomes and Purse**: genuine processor settlement and bank/provider readback, fees, taxes, refunds, and separately reconciled revenue before Profit Waterfall or reinvestment. Synthetic work orders must NEVER enter owner payouts or capital labs.
7. **Unattended operations**: host commissioning, budget and action policy, error alerts, genuine delivery canary, multi-day restart/restore receipts and iPhone acceptance.

**Do not treat the synthetic happy path as a production launch certificate.** BIZ-PURSE.17 remains external-commissioning blocked even if all code regressions pass.
