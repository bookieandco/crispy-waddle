# SAM-PROD.1–8 Production Activation

Date: 2026-09-20

## Status

Source implementation for SAM-PROD.1 through SAM-PROD.8 is complete on this branch.

Production acceptance remains fail-closed until environment-bound checks are actually evidenced. A green source CI run is necessary but not sufficient to claim the deployed SAM service is live.

## SAM-PROD.1 — Merge / convergence audit

- `@jhadina/opportunity-core` remains the canonical SAM domain owner.
- The app layer owns transport, persistence composition, operator projection and external execution adapters.
- Legacy app-local SAM ranking/intelligence/economics modules are not promoted as canonical.
- The production route emits canonical Opportunity objects, not raw SAM payloads.
- Caller-controlled user identity is not accepted.

## SAM-PROD.2 — Database deployment verification

Implemented deployment surface:
- canonical `jhadina_opportunities` storage with authenticated-user RLS
- SAM pursuit snapshot storage
- checksum recovery validation
- optimistic revision enforcement
- trusted service-role snapshot write RPC bound to verified user identity

Deployment acceptance requires evidence that the migrations are applied in the target Supabase project and that cross-user access/write attempts fail.

## SAM-PROD.3 — Live SAM.gov ingestion

The authenticated SAM route now performs:

`validated query → SAM.gov transport → canonical normalization → ingestion audit → expired-record exclusion → authenticated canonical persistence → canonical response`

The API key remains server-side. Upstream non-2xx responses fail closed. Unsupported/invalid query parameters are rejected. Duplicate/invalid canonical records are blocked before persistence.

A production acceptance receipt still requires a successful call against the deployed SAM.gov credential; source CI does not fabricate that receipt.

## SAM-PROD.4 — End-to-end pursuit drill

`sam-production-pipeline.ts` composes canonical requirement decomposition, provider shortlist, fulfillment planning and provider freshness into a production candidate.

The candidate is decision support only:
- `executionAuthorized: false`
- unresolved fulfillment blocks
- stale assigned-provider evidence blocks
- human review remains required

The existing SAM-SUB golden cases cover direct fulfillment, complementary teams, set-asides, stale evidence and no-provider outcomes.

## SAM-PROD.5 — Provider discovery adapters

Canonical provider inputs remain `FulfillmentProvider` records with:
- verified identity evidence
- verified capability evidence
- service geography
- credentials
- past performance / award evidence
- capacity evidence
- source IDs

Identity resolution prefers UEI/CAGE/registration evidence and leaves ties ambiguous. Award history is bound only after deterministic identity resolution. Staffing Core remains the workforce source; no SAM-specific worker database is created.

External discovery sources may populate these canonical records, but cannot bypass provider verification or freshness gates.

## SAM-PROD.6 — Human-control operator surface

`sam-operator-view.ts` exposes:
- opportunity status
- fulfillment structure
- provider roles/scores/requirements
- blockers
- evidence references
- review/refresh/outreach-preparation actions

It explicitly exposes:
- `bidSubmissionAuthorized: false`
- `outboundSendAuthorized: false`
- `contractExecutionAuthorized: false`

## SAM-PROD.7 — Communications execution boundary

`sam-outbound-execution.ts` is the only production execution adapter added here.

It requires:
1. a canonical draft-only outreach packet
2. a separate active single-send authorization
3. an authorization ledger event
4. an external transport receipt
5. append-only recording of the consumed send authorization

The transport is injected. Opportunity Core does not call email/SMS/portal connectors directly. Reusing a consumed authorization is rejected. Send authority never implies contract authority.

## SAM-PROD.8 — Production acceptance

`sam-production-acceptance.ts` requires evidence-backed passed checks for all six categories:

1. CI
2. database
3. configuration
4. live SAM ingestion
5. governance
6. recovery

Any missing, pending, failed or unevidenced category blocks acceptance.

Even an accepted report has `productionExecutionAuthority: false`; acceptance means the production pipeline is operational, not that Jhadina may autonomously bid, sign, pay or contact providers.

## Environment-bound acceptance checklist

Before labeling a deployed environment accepted, collect receipts for:

- Opportunity Core CI green on this branch
- Supabase migrations applied
- own-user read succeeds and cross-user read fails
- untrusted snapshot write fails
- trusted server snapshot write succeeds
- optimistic stale revision write fails
- checksum-tampered recovery fails
- `SAM_GOV_API_KEY` configured server-side
- authenticated live SAM search succeeds
- malformed query fails with 400
- upstream SAM failure does not persist partial data
- duplicate canonical notice is rejected by ingestion audit
- expired notice is not persisted as an active candidate
- operator projection never grants bid/send/contract authority
- outbound transport is never invoked without active single-send authorization
- single-send authorization cannot be reused
- contract/signature/payment remain outside this production activation

## Explicit non-claims

This source branch does **not** claim:
- that the target Supabase migration has already been applied
- that a live SAM.gov credential has already been exercised from the deployed environment
- that a real provider has been contacted
- that a real bid has been submitted
- that any contract has been executed
- that any payment has been authorized

Those require environment receipts and/or explicit human action.
