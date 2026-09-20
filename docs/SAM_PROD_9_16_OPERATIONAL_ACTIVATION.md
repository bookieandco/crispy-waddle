# SAM-PROD.9–16 Operational Activation

Date: 2026-09-20

## SAM-PROD.9 — Live SAM.gov certification

Implemented a canonical live-certification contract that records configuration, request success, returned/canonicalized/malformed counts, duplicate accounting and pagination observation.

The certification gate distinguishes `pass`, `fail`, and `environment_blocked`. It never converts a successful source check into outreach or bid authority.

The production SAM transport remains server-only, no-store, bounded, authenticated at the Jhadina route, and canonicalizes upstream records before persistence.

## SAM-PROD.10 — Real provider discovery connectors

The provider adapter surface from SAM-PROD.5 is retained as the only ingestion boundary for entity-directory, award-history, workforce, local-business, web-search and manual observations.

Connectors are adapters, not truth owners. Every observation enters Opportunity Core as discovery evidence and an unverified provider.

## SAM-PROD.11 — Provider identity resolution

Provider research now composes discovery with the existing canonical identity resolver.

UEI/CAGE/registration evidence can strengthen identity resolution. Ambiguous or unmatched entities remain blocked for evidence review rather than being silently merged.

## SAM-PROD.12 — Evidence verification and freshness runtime

Provider research now evaluates the existing freshness policy immediately after discovery. Missing capacity evidence, stale regulated evidence and expired credentials remain explicit blockers.

Discovery data itself is not upgraded to verified merely because a source returned it.

## SAM-PROD.13 — Opportunity → provider research automation

Added `runSamProviderResearch`.

Input:
- canonical decomposed SAM requirements;
- configured provider discovery adapters;
- optional known verified provider population.

Output:
- discovery evidence;
- identity-resolution results;
- freshness results;
- research blockers;
- explicit research status.

Hard boundary:
- `outreachAuthorized: false`
- `bidSubmissionAuthorized: false`

## SAM-PROD.14 — Operator workspace

The existing Opportunity Command Center remains the operator entry point. The governed SAM pursuit projection is the canonical state supplied to a SAM-specific workspace: requirements, provider fulfillment, economics, freshness, engagement readiness, negotiation, contract readiness and contract drafting.

UI controls may request domain transitions but never constitute authority by themselves.

## SAM-PROD.15 — Governed communications adapter

Added `GovernedProviderTransport` and `transmitAuthorizedProviderPacket`.

Transport invocation requires:
- an active packet-scoped authorization;
- a previously recorded `send_authorized` ledger event;
- an unused single-send authorization;
- exact authorized channel and destination;
- an idempotency key equal to the authorization ID;
- a returned external message receipt.

The transport receipt explicitly carries:
- `contractAuthority: false`
- `bidSubmissionAuthority: false`

The actual email/portal provider remains deployment-configurable and is intentionally not hard-wired into Opportunity Core.

## SAM-PROD.16 — Production pilot / acceptance

Certified non-destructive pilot behavior covers:
- live-source certification semantics;
- provider discovery;
- identity ambiguity;
- missing evidence/freshness blocking;
- research automation;
- single-send transport authorization;
- canonical SAM-SUB golden cases already covering direct fulfillment, complementary teams, set-asides, clearance gaps, stale evidence, destructive counteroffers and no-provider outcomes.

### Production acceptance rule

SAM-PROD.16 is accepted for governed operation when the dedicated Opportunity Core CI is green.

A deployed environment may additionally produce a SAM-PROD.9 `pass` observation by exercising its configured `SAM_GOV_API_KEY`. If the secret is absent in CI, the live certification must report `environment_blocked`, never fabricate success.

### Authority boundary

Nothing in SAM-PROD.9–16 authorizes:
- automatic provider outreach;
- automatic bid submission;
- contract execution;
- signature;
- payment.

The system can automate research and prepare governed actions. Consequential external actions remain separately authorized and auditable.
