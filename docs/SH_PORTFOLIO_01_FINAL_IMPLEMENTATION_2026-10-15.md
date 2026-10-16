# SH-PORTFOLIO.01 → SH-PORTFOLIO.FINAL — implementation, gates, and acceptance
Date: 2026-10-15 Pacific. Repository: `bookieandco/crispy-waddle`.
Branch: `audit/side-hustle-portfolio-2026-10-15` (PR #1313).
Authority: Opportunity Core + Venture Lab + existing approved owning executors. Nothing here creates a second Side Hustle engine.

## Source reconciliation / preservation
- Base audited main commit `cc694fcf7c8bd07f62f598bc67f596cc98b7bc57`.
- The stale Side Hustle runtime branch has zero commits ahead of main; runtime was merged by PR #997. Commissioning and drop servicing were merged by PR #1011.
- Current main already has 26 canonical families, 25 commercial software-ready families and a trading intelligence capability-only lane. Preserve these registries and existing service, commerce, provider, Director, Growth, PupsonStuff, Money and Venture repositories.

## SH-PORTFOLIO.01 — Runtime and storage verification
**Code and findings**
- Vercel showed `crispy-waddle-jhadina-web` production deployment `READY` for audited main SHA `cc694fcf…`. This only proves a deployment reached READY, not API/database end-to-end health.
- `Swlc` Supabase project reports `ACTIVE_HEALTHY` in management metadata; direct read-only SQL and migrations failed PostgreSQL `57P03`: database not accepting connections / hot standby disabled.
- Read-only PostgreSQL logs on October 16 UTC show ongoing recovery redo and connection rejections. Do not replay migrations, disable RLS, or restart/restore blindly while recovery is in progress.
- Existing [SWLC disk exhaustion P0 #1110](https://github.com/bookieandco/crispy-waddle/issues/1110) documents an earlier `No space left on device` event, repeated WAL/crash recovery and an explicitly **unapproved** owner capacity/paid-plan decision. Treat the storage outage as an existing incident, not a new Side Hustle schema defect. Do not authorize an upgrade, payment, new project or restoration on the owner's behalf.
- Supabase published an October 30, 2026 public-table Data API exposure change. Before any future migration, independently check explicit table/function GRANTs and owner-scoped RLS.
- CI must be interpreted from exact PR head checks, not stale green builds. No synthetic DB acceptance.
**Repair sequence when DB accepts read-only connections**
1. Verify backups and isolated restore capability, migration versions and schema drift, RLS and public grants.
2. Verify owner-scoped `jhadina_side_hustle_*` and `jhadina_venture_*` tables/RPCs and source/receipt constraints without modifying prod.
3. Exercise authenticated, read-only `/api/side-hustles/portfolio/acceptance` and confirm zero cross-owner observations.
4. Run exact-head Opportunity CI and Postgres integration tests. Record actual URL/run IDs and outcomes. Do not interpret a 503 fail-closed response as green.
5. Only after evidence, plan reviewed, separately approved migration fixes (none deployed in this PR).

## SH-PORTFOLIO.02 — Three shortest zero-subscription service pilots
- **Research Services**: qualify one real buyer/Opportunity. Create canonical work order with original research brief, source provenance, price, customer acceptance criteria; deliver one citation-rich report via Opportunity/Overage executor; record customer acceptance and settled payment.
- **AI Discovery / SEO**: complete a first-party or explicitly authorized read-only site audit from actual crawl/search evidence, identify fixes and evaluate baseline. CMS modifications and social publication require their original approval paths; no fabricated Search Console data.
- **Boring Business Services**: scope one repetitive spreadsheet/report/SOP cleanup, redact customer PII appropriately, quote exact bounded workload, QA, deliver and record acceptance.
- The first pilot to start must be chosen by real buyer demand and an eligible persisted Venture validation admission—not by deterministic “A” grade alone.
- This PR does not create fake customer accounts, backdated opportunity receipts, automated outreach, unpaid invisible labor or guaranteed income.

## SH-PORTFOLIO.03 — Reuse production factories
- Creative Advertising & Media Production: Director holds media rights, source/provenance, variant generation, QC, accepted final delivery; Growth owns attribution. Cost and render usage require exact limits.
- Business Automation & Website Revenue: Builder/authorized connector boundaries own implementation and rollback; read-only audits can run before customer writes.
- Digital Products: original assets, rights check, delivery entitlement, refund/chargeback and actual checkout receipts.
- This sequence reuses canonical Commercial Work Order, routing, delivery, acceptance, outcome bridge and maturity learning. No new competing ticket store.

## SH-PORTFOLIO.04 — Controlled provider commerce
- PupsonStuff: real Printify credentials/variant binding and physical sample QA, then a specifically approved test order, webhook/tracking reconciliation and realized unit economics. No sample or supplier purchasing without approval.
- Affiliate: read-only legitimate provider integration, current terms, disclosures, reversed/approved/paid commission statuses, payout-grounded realized contribution. Affiliate clicks are not revenue.
- Content/Social: approved provider scope, exact approved scheduled payload, provider publication receipt, observed analytics and attributable customer outcome.
- Commerce/fulfillment and money actions remain governed by owning domains; no new authority is minted.

## SH-PORTFOLIO.05 — Later businesses
- Software/App subscription and membership: deployment, tenant entitlements, cancellation/refund, billing verification, support and renewal evidence.
- Directories/owned media: independently observed demand and current analytics before selling placement or scaling content.
- Drop servicing: provider quotes/assignments, SLA, customer acceptance, actual provider costs and rework.
- Procurement/subcontracting: real current public award and legally governed teaming/contact/bid/contract path.
- Dropshipping: legitimate provider terms/Shopify/Supliful idempotency, owner-approved order, fulfillment outcome.
- Physical assets: inventory/custody, deposit/insurance/legal compliance, bookings, handoffs, incident/maintenance and utilized paid asset.
- Human premium services remain human-delivered; Money trading is capability-only (no business-factory trade authority).

## SH-PORTFOLIO.FINAL — Commercial acceptance truth
New `packages/opportunity-core/src/domain/side-hustle-portfolio-evidence.ts` checks same-work-order lineage, linked routing scope, authorized delivery executor/start, customer acceptance of all required criteria, dated domain-sourced canonical outcome, and transaction references. It rejects orphan receipts, mismatched delivery/acceptance/outcome, future observations, absent/uncertain settlement references and illegal authority flags. Domain-reported transaction references are **still not provider-signed or independently verified settlement proof**.

New owner-authenticated `GET /api/side-hustles/portfolio/acceptance` reads existing commercial/commissioning repositories. It emits each canonical family’s software, commissioning, linked evidence status, outstanding blockers, and `independentlyCertified:false`. It is read-only and fail-closed (503 `PORTFOLIO_STORAGE_UNVERIFIED` on storage failures; 401 without identity). If all currently countable records exist, it may show `ready_for_manual_acceptance` but NEVER claims a live independently certified business solely from claims.
Existing commercial certification runtime now counts only correlated evidence chains instead of unrelated cumulative receipts. Existing commissioning checks now ignore future-dated observations and refuse `not_applicable` as a substitute for required gates. Backdated, mock, user-attributed, currency-mismatched and synthetic receipts cannot be assumed independently settled; add provider-signed truth adapters as a separate reviewed task when a legitimate account is connected.

**Acceptance cannot be declared complete until**: actual prod DB/RLS/migrations confirmed; identity/tenant boundary validated; provider/customer consent and receipts attached; live pilot delivery and independent settlement proven; exact-head CI and production readback green; immutable outcome and learning verified; no unapproved spend, outreach, bid, publish or trade. Until then state remains **software changes prepared / live commercial acceptance BLOCKED**.

## Source-of-truth acceptance checklist
- [ ] `Swlc` read-only Postgres and migration query succeeds, with backup/security review
- [ ] Owner-isolated production API readback and zero cross-owner leakage proven
- [ ] Exact-head Opportunity/web/Postgres CI green
- [ ] Research-service first customer accepts one real deliverable
- [ ] Exact provider-signed payment settlement and refund/reversal truth
- [ ] Growth/Director/PupsonStuff pilots separately provider commissioned
- [ ] Family-specific legal/safety/QA gates passed
- [ ] Canonical outcome→Venture/Opportunity memory, bounded maturity assessment verified
- [ ] Human owner signs off on LIVE.FINAL evidence and authorizations
