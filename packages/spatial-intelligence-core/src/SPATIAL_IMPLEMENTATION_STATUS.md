# Spatial implementation status

## GEV P1 through P10 implementation state

The Jhadina-owned spatial control plane is implemented and remains fail-closed. GEV is integrated as a provider/source and visualization input, not as a second truth system, policy engine, or executor.

Canonical flow:

`GEV/source → SpatialObservation → SpatialEvidence → claim/reality admission → SpatialReality → SpatialContext → Jhadina/Director/DELIA/JANET/MARISA`

Consequential actions remain on the existing Jhadina policy/approval/ActionExecutor path.

Implemented in repository source:

- P1 — allowlisted same-origin GEV provider bridge.
- P2 — provider-neutral adapters for CCTV, aircraft, vessels, active fires, earthquakes, satellites and infrastructure records.
- P3 — source policy registry carrying attribution, privacy, commercial-use, publication, model-input, replay, redistribution and retention dispositions.
- P4 — production SpatialContextProvider composition for Ask Jhadina, with content-addressed evidence persistence when the service-role store is configured.
- P5 — Jhadina Spatial World, authenticated spatial context API, append-only workspace revisions and as-of replay.
- P6 — durable canonical Knowledge Graph store/schema plus evidence-backed source/entity projection.
- P7 — JANET presentation-only personalization, DELIA intelligence-only analysis and MARISA policy-gated operation proposals.
- P8 — bounded intelligence-only spatial projections for Money, Sports, Opportunity, Courier, Safety, Research and Media.
- P9 — explicit derived-perception firewall; model output is marked inferred and cannot masquerade as a source observation or canonical reality.
- P10 — adversarial conformance tests for licensing/privacy fail-closed behavior, source separation, workspace replay, role authority, prediction/reality separation and explicit reality admission.

The canonical evidence/reality boundary remains unchanged:

- observations do not establish reality;
- evidence is immutable/content-addressed;
- fallback-only evidence cannot promote a candidate to canonical reality;
- predictions/scenarios remain distinct from admitted reality;
- model perception remains derived intelligence.

## Repository verification state

The previous frozen-lockfile blocker has been source-repaired: the current `packages/jhadina-core-spine` importer in `pnpm-lock.yaml` matches its manifest. That repair is not treated as CI evidence by itself.

The final repository gate still requires a fresh successful Spatial Conformance run on the current `main` lineage. Repository-wide workflows may still expose unrelated subsystem failures; those must be distinguished from spatial-specific failures in the recorded evidence.

## Remaining production evidence

The following still require live/deployed verification and therefore remain UNKNOWN rather than PASS:

1. GEV endpoint configuration/connectivity and live source health.
2. Applying and verifying the new Supabase workspace/knowledge migrations in the deployed database.
3. Live observation → durable evidence → claim → reality admission execution.
4. Real-source temporal freshness/outage behavior.
5. Multi-source corroboration with upstream-independence checks against production feeds.
6. Deployed privacy/security checks and provider-term enforcement.
7. Production telemetry, audit, recovery and operational monitoring.
8. Vercel deployment while the account build-rate limit is active.

## Final gate rule

SPATIAL/GEV source implementation is complete through P10, but production readiness remains **BLOCKED / FAIL-CLOSED** until the remaining runtime/deployment checks are independently verified. Architecture/source completion must never be used as a substitute for live evidence.
