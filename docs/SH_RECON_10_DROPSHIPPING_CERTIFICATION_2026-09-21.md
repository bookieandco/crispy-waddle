# SH-RECON.10 — Dropshipping certification

Date: 2026-09-21
Branch: feat/sh-recon-dropshipping-certification
Base: main
Certification level: ADAPTER_READY
Live supplier purchasing: NOT CERTIFIED

## Decision

SH-RECON.1 through SH-RECON.10 are complete for the governed, provider-neutral dropshipping architecture.

This certification means Jhadina can:
- normalize observed supplier research through a read-only provider adapter;
- route supplier offers deterministically;
- create a Commerce-owned procurement preview from a canonical Opportunity handoff;
- fingerprint the exact supplier/product/order/quantity/cost/destination/evidence tuple;
- require explicit approval;
- consume that approval once through Action Core;
- execute only through a registered supplier procurement ActionHandler;
- preserve idempotency and external supplier-order identity;
- reconcile the narrow provider-accepted/durable-write-failed window without resubmitting;
- expose supplier execution facts for existing Commerce/Money/Opportunity outcome reconciliation.

It does not mean a live 1688, AliExpress, or other supplier account is connected. No default live supplier transport or credentials are shipped. The provider registry therefore truthfully reports dropshipping as adapter_ready, not live.

## SH-RECON closure

### SH-RECON.1 — salvage/reconciliation
PASS.
The work was rebuilt on current main rather than extending the stale SH authority branch. No opportunity-contracts or commerce-capability-binding authority was brought forward.

### SH-RECON.2 — canonical dropshipping handoff
PASS.
Opportunity Core now exposes createDropshippingProcurementActionIntent().
It requires a commercialKind=dropshipping opportunity and produces:
- executionOwner = commerce
- capability = commerce.supplier.procure
- requiresPolicy = true
- requiresApproval = true
- evidence-linked, expiring handoff

### SH-RECON.3 — supplier/product research boundary
PASS at adapter-ready level.
Commerce adapters define SupplierSourcingAdapter and SupplierOfferSnapshot.
Supplier1688SourcingAdapter is read-only normalization over an injected research client. It does not log in, mutate cart state, contact sellers, or purchase.

### SH-RECON.4 — competitive/evidence discipline
PASS by boundary.
Supplier sourcing observations remain observed provider facts. Opportunity handoff requires evidence refs. The procurement preview preserves those refs and cannot execute with an evidence-empty preview.

External reference audits reinforce the same observed/inferred/recommended separation; no external repository was imported wholesale.

### SH-RECON.5 — deterministic supplier routing
PASS.
routeSupplierOffers() enforces:
- positive integer quantity;
- inventory sufficiency;
- currency match;
- nonnegative unit and shipping cost;
- supplier risk ceiling;
- delivery ceiling;
- destination allow-list / wildcard;
- explicit destination exclusions overriding wildcard;
- deterministic ranking by landed cost, delivery, risk, supplier, connection, product.

Routing remains decision-only and has no supplier side effects.

### SH-RECON.6 — immutable procurement preview
PASS.
SupplierProcurementPreview binds:
- provider / connection / supplier;
- product / inventory / external product;
- Opportunity and research case;
- evidence refs;
- internal order and order-item IDs;
- quantity;
- unit, shipping, and total cost;
- currency and destination;
- delivery estimate;
- deterministic idempotency key;
- prepared and expiry timestamps.

Validation proves total arithmetic, evidence presence, expiry ordering, and idempotency identity.

### SH-RECON.7 — Action Core governed procurement
PASS.
commerce.supplier.procure is an approval-required Commerce capability.
VerifiedActionExecutor now carries ApprovalReceiptVerifier into ActionExecutor.
SupplierProcurementActionHandler is the only supplier mutation path introduced by this reconciliation.
The handler validates actor, capability, preview, handoff freshness, preview freshness, idempotency, and result identity.

### SH-RECON.8 — supplier-order identity and reconciliation
PASS.
SupplierProcurementResult preserves:
- procurement ID;
- supplier/connection/product/inventory;
- internal order/order-item;
- deterministic idempotency key;
- ExternalReference for supplier order;
- optional tracking reference;
- provider status/timestamps/error code.

reconcileSupplierProcurement() is read-only against the provider idempotency lookup and never resubmits an order.

### SH-RECON.9 — fulfillment / financial outcome lineage
PASS at contract boundary.
Supplier result records preserve the identifiers and cost-bearing approved preview required by downstream Commerce reconciliation. Existing Opportunity outcome truth already supports Commerce/Money source ownership, transaction refs, action refs, execution refs, direct costs, fees, profit, margin, and dollars/hour. No duplicate financial ledger was created.

Live carrier tracking and Money actuals remain downstream provider/runtime integrations; they are not fabricated by this certification.

### SH-RECON.10 — targeted certification
PASS.

GitHub Actions workflow: SH Dropshipping Certification
Successful run: 35656118234

Gates passed:
1. frozen pnpm install;
2. Action Core type-check;
3. Action Core tests — 21 passed / 21;
4. Commerce adapters type-check;
5. Opportunity Core type-check;
6. canonical dropshipping handoff test;
7. governed Commerce supplier test suites — 3 files passed, 19 tests passed;
8. targeted dropshipping web TypeScript boundary.

Adversarial coverage includes:
- no side effect before explicit approval;
- actor mismatch rejection;
- single-use approval receipt;
- exact proposal fingerprint binding;
- malformed 1688 row rejection;
- destination exclusion over wildcard;
- deterministic landed-cost-first routing;
- preview arithmetic mismatch rejection;
- provider idempotency;
- recovery after provider success followed by durable write failure, without a second submit.

## Broader repository gates

Opportunity Core CI: PASS on the certification branch.
Spatial Conformance: PASS.
Staffing Postgres Integration: PASS.
Director Targeted Tests: PASS.

The broad Jhadina Web production build remains blocked by an unrelated Director type mismatch in lib/director-generation-composition.ts (SupabaseClient vs SupabaseStoryboardClient). The same broad web type surface also reports unrelated Director/generation errors. These files are outside the SH-RECON diff and are not weakened or bypassed here.

Media Production Certification similarly reaches the shared jhadina-web type-check and fails on the unrelated web type debt. This is not counted as a dropshipping pass, nor is it misreported as a dropshipping defect.

Vercel may also report the separately tracked build-rate-limit failure; SH certification does not reinterpret infrastructure rate limiting as provider readiness.

## Reference audits incorporated

- superjack2050/1688-cli — research/compare/supplier patterns and explicit prepare -> current-turn approval -> confirm safety model;
- victorabuchi/onshipy — product/store/order concepts; auto-buy worker rejected as a production implementation because it fabricates a manual order ID;
- openlinker — typed capability ports, identifier mapping, retries/dedup/reconciliation patterns;
- yourincomehome/awesome-passive-income — side-hustle taxonomy/reference only;
- freelance-work references including bounty/paid-issue models — Placement/Opportunity reference patterns;
- ncreighton AI productivity PDF repo — productization concept only; no generator implementation;
- ckw19810413/digital-product-research — bottleneck/research loop reference for future Opportunity/Growth intelligence.

## Production truth

Certified now:
Opportunity research/evidence
-> canonical dropshipping handoff
-> supplier research normalization
-> deterministic routing
-> Commerce procurement preview
-> explicit approval
-> Action Core execution
-> supplier adapter port
-> durable proposal/audit state
-> idempotent supplier-order reconciliation
-> downstream outcome lineage

Not certified now:
- live 1688 login/session;
- live 1688 checkout;
- AliExpress live transport;
- supplier credentials;
- anti-bot / slider handling;
- real seller messaging;
- real-money supplier purchase;
- carrier-specific live tracking.

Those require a separately authorized live-provider certification and must not be inferred from ADAPTER_READY status.
