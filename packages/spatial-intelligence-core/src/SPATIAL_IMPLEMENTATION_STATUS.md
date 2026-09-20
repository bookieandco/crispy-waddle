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

Fresh Spatial Conformance evidence is recorded on the final P10 verification lineage: GitHub Actions run 168, job 106010467724 completed successfully after spatial type-check, 14/14 Vitest assertions, and 42/42 Node/TAP conformance tests. The production health-route follow-up also passed Spatial Conformance run 204 / job 106013585098, including the same 14/14 + 42/42 core suites and 1/1 dedicated fail-closed `/api/spatial/health` test. Repository-wide workflows may still expose unrelated subsystem failures; those remain separate from the spatial gate.

## Live database verification

The Jhadina Supabase production project now has the complete spatial persistence schema installed and verified:

- `20260920030347_create_jhadina_spatial_evidence`
- `20260920030358_create_jhadina_spatial_reality`
- `20260920030403_create_jhadina_spatial_workspace_revisions`
- `20260920030407_create_jhadina_knowledge_graph`
- `20260920030454_harden_jhadina_spatial_append_only_privileges`
- `20260920030535_harden_jhadina_spatial_trigger_search_path`

All six spatial/knowledge tables have RLS enabled and a restrictive service-role policy. `anon` and `authenticated` have no direct table privileges. `service_role` is reduced to `SELECT, INSERT` only, closing UPDATE/DELETE/TRUNCATE append-only bypasses. The four spatial append-only trigger functions use `search_path=pg_catalog`, and the Supabase security advisor no longer reports spatial-specific search-path findings.

A read-only `/api/spatial/health` production gate is implemented and independently tested fail-closed. It exposes only readiness booleans plus deployment identity; it does not expose provider URLs, credentials, database rows or upstream payloads.

## Deployment verification

The production alias currently resolves to READY deployment `dpl_GhzhDUFagdyGABQmuZPLNNpS4sLA`, built from commit `dee990b6c5d8d8d8836d7eb9ef706f2656e913ce` ("Style homepage story detail surface"). That deployment predates the GEV Spatial integration, while current `main` contains the merged P1-P10 implementation, database gate, health endpoint, migration-history alignment and fail-closed health test.

GitHub's Vercel status on current `main` is a build-rate-limit failure. Therefore production provider reachability is **BLOCKED**, not merely unknown: the active alias cannot exercise code that has not yet been deployed.

## Remaining production evidence

The following still require a successful current deployment and live verification:

1. GEV endpoint configuration/connectivity and live CCTV health from the deployed Jhadina runtime.
2. `/api/spatial/health` returning `READY` on the current production commit.
3. Live observation → durable evidence → claim → reality admission execution.
4. Real-source temporal freshness/outage behavior.
5. Multi-source corroboration with upstream-independence checks against production feeds.
6. Deployed provider-term/privacy enforcement across real upstream responses.
7. Production telemetry, audit, recovery and operational monitoring.

## Final gate rule

SPATIAL/GEV source implementation and the production database gate are complete through P10, but production readiness remains **BLOCKED / FAIL-CLOSED** until the remaining provider/runtime/deployment checks are independently verified. Architecture/source completion must never be used as a substitute for live evidence.
