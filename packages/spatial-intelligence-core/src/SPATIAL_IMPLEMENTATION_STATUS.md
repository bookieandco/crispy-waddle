# Spatial implementation status

## SPATIAL-01 through SPATIAL-16 remediation phase

The provider-neutral spatial control plane remains implemented and fail-closed. The remediation phase has now added the missing integration seams that can be implemented inside `crispy-waddle` without importing GEV application state or creating a second authority system.

Implemented:

- Canonical `SpatialObservation` contract with validation and explicit `inference: false`.
- Canonical Jhadina knowledge-graph package restored at `packages/knowledge-graph` because the repository's TypeScript configuration and architecture referenced it while the package was absent from the checked-in tree.
- GEV CCTV normalization adapter that converts camera snapshots into canonical spatial observations/evidence without importing GEV rendering, navigation, or action state.
- GEV adapter conformance tests for coordinates, provenance, and non-inference semantics.
- Knowledge-graph integrity tests requiring relation endpoints and preserving provenance.
- Existing Context Builder remains the sole context assembly boundary; spatial contributions remain additive under `ContextPacket.domainContext.spatial`.
- Existing Ask Jhadina command remains the governed entry point; spatial access is injected through the read-only `SpatialContextProvider` boundary.
- Existing Director registry remains the Director authority boundary; spatial capabilities are read-only.
- Existing reality admission remains the only path by which spatial candidates can become admitted reality.

## Remaining final-gate evidence

The following cannot honestly be marked PASS from repository source inspection alone:

1. GEV-to-Jhadina deployment connectivity and live source health.
2. Durable graph persistence/migration verification against the deployed database.
3. Durable spatial workspace persistence and replay verification.
4. Production spatial provider wiring in the deployed Ask Jhadina route.
5. End-to-end camera frame -> evidence -> claim -> reality admission execution.
6. Privacy/security conformance against deployed endpoints and operational configuration.
7. Full CI/type-check/test evidence after the repository lockfile is repaired.
8. Production deployment and operational telemetry evidence.

The known repository-wide frozen-lockfile problem remains a release blocker: the checked-in `pnpm-lock.yaml` is not currently trustworthy for a clean `pnpm install --frozen-lockfile` run. No readiness gate may treat source-level implementation as a substitute for that evidence.

## Final gate rule

SPATIAL-16 remains **BLOCKED / FAIL-CLOSED** until every required check is independently verified. Architecture completeness, source-level implementation, and production readiness are deliberately separate states.
