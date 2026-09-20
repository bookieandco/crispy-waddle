# SAM-PROD.17–24 Operational Closeout

Date: 2026-09-20

## SAM-PROD.17 — Repository convergence
PASS. PRs #427 and #428 are merged on main. The production tranche starts from current main and keeps Opportunity Core as the canonical SAM subcontracting domain. App-local SAM files remain transport/UI adapters, not authority owners.

## SAM-PROD.18 — Real SAM live-source acceptance
READY / ENVIRONMENT-GATED. The authenticated SAM route uses the server-side SAM client, validated allowlisted query input, canonicalization, canonical persistence, no-store responses and bounded upstream queries. The live certification contract refuses to invent success when the deployed SAM_GOV_API_KEY is unavailable to the test environment.

## SAM-PROD.19 — Real provider-source adapters
PASS AT ADAPTER BOUNDARY. Provider discovery has canonical adapter contracts for entity directory, award history, workforce, local business, web search and manual evidence. Source adapters return observations only; they do not confer verification or authority.

## SAM-PROD.20 — Provider Intelligence Pipeline
PASS. Canonical research composes requirement-derived discovery queries, identity resolution and evidence freshness. Unmatched/ambiguous identity and stale/missing evidence remain blockers. Discovery never upgrades itself to verified.

## SAM-PROD.21 — Pursuit Workspace
PASS AT GOVERNED PROJECTION BOUNDARY. The Opportunity Command Center is the operator entry point; SamGovernedPursuitPlan supplies stage status, blockers, evidence references, human gates and next stage across requirements, provider fulfillment, commercial review, freshness, engagement, negotiation, contract readiness and contract drafting. UI state is not authority.

## SAM-PROD.22 — Governed real communications
PASS AT TRANSPORT BOUNDARY. GovernedProviderTransport can be bound to email/portal infrastructure only after an exact packet-scoped active send authorization has been recorded. Single-send consumption and external receipt requirements remain enforced. Contract and bid authority remain false.

## SAM-PROD.23 — Subcontract lifecycle
PASS. Added a digest/version-bound contract execution packet. A contract whose clauses, redlines or version change after signature review cannot reuse the prior approval. The domain records an externally executed contract receipt; it does not sign the document. Signature, execution and payment authority remain false.

## SAM-PROD.24 — Production pilot
PASS FOR NON-DESTRUCTIVE PILOT CERTIFICATION. Added an acceptance gate requiring at least three cases, successful persistence recovery and zero unauthorized external actions. Metrics capture candidate volume, identity blocks, freshness blocks, false positives and human overrides.

A live pilot can be marked environment_blocked when all cases lack a deploy-time live SAM certification; this is not converted into a false pass.

## Terminal invariant
The system may continuously research, rank, assemble, draft and prepare governed actions. It may not independently submit a federal bid, contact a provider without a packet-scoped send authorization, sign/execute a subcontract, or authorize payment.
