# Spatial 16 — Final Spatial Readiness Gate

Status: **SOURCE COMPLETE / PRODUCTION BLOCKED / FAIL-CLOSED**

This gate distinguishes source implementation from live production certification. Passing source conformance, installed migrations, or an old READY deployment is not proof that the current Spatial runtime works in production.

## Control path

`SpatialSource → SpatialObservation → SpatialEvidence → SpatialClaim candidate → explicit SpatialReality admission → SpatialContext → Jhadina → Director/DELIA/JANET/MARISA boundaries`

Actions remain outside spatial intelligence and continue through the existing `Director → Policy → Approval → ActionEnvelope → Capability → Executor` governance path.

## Stage disposition

| Stage | Area | Gate disposition |
| --- | --- | --- |
| SPATIAL-01 | Spatial Intelligence Core | PASS — canonical contracts, validation and provider-neutral boundary |
| SPATIAL-02 | Source Registry | PASS — provider/source identity and health semantics |
| SPATIAL-03 | Evidence Fabric | PASS — immutable/content-addressed evidence + durable adapter |
| SPATIAL-04 | Reality Engine | PASS (source) — explicit candidate/admission separation + durable stores |
| SPATIAL-05 | Temporal Engine | PASS — freshness/continuity semantics |
| SPATIAL-06 | Fusion Engine | PASS — duplicate-upstream false corroboration rejected |
| SPATIAL-07 | Knowledge Graph | PASS (source + DB) — durable schema/store and evidence-backed projections installed |
| SPATIAL-08 | Context Package | PASS (source) — bounded Spatial context contribution to canonical ContextPacket |
| SPATIAL-09 | Workspace | PASS (source + DB) — append-only durable revisions and as-of replay |
| SPATIAL-10 | Attention | PASS — deterministic ranking preserves evidence/limitations |
| SPATIAL-11 | Ask Jhadina Query | PASS (source) — conservative planner + read-only production provider seam |
| SPATIAL-12 | DELIA Reasoning | PASS (source) — intelligence-only reasoning |
| SPATIAL-13 | MARISA Operations | PASS (source) — proposal-only; existing approval/policy path remains authoritative |
| SPATIAL-14 | Director Capability | PASS (source) — provider-neutral Spatial capabilities; no Spatial executor |
| SPATIAL-15 | GEV Adapter + Live Video | PASS (source), LIVE BLOCKED — bridge/adapters/policy exist; current production deployment predates them |
| SPATIAL-16 | Final Conformance | BLOCKED — live deployment, E2E admission, adversarial runtime, telemetry/recovery receipts outstanding |

## Live production state — 2026-09-20

- Production still resolves to Vercel deployment `dpl_GhzhDUFagdyGABQmuZPLNNpS4sLA` at `dee990b6c5d8d8d8836d7eb9ef706f2656e913ce`, which predates Spatial/GEV.
- Current Spatial-capable deployments are blocked by Vercel `api-deployments-free-per-day`.
- All six Spatial/Knowledge Graph tables exist in live Supabase with RLS enabled.
- During the production audit, drifted `service_role UPDATE` grants on the two append-only Knowledge Graph tables were revoked; all six protected tables now match the committed `SELECT, INSERT` service-role boundary.
- All six production Spatial/Knowledge Graph tables currently contain zero rows; therefore no live source→evidence→Reality receipt exists yet.
- The authoritative detailed runtime audit is `docs/architecture/GEV-PROD-certification-audit-2026-09-20.md`.

## Required final evidence before certification

1. Current Spatial lineage successfully deployed and production alias moved.
2. `/api/spatial/health` returns `READY` with GEV reachable and all six DB checks reachable.
3. CCTV, aircraft, vessel and FIRMS live-source receipts preserve source identity, attribution/licensing, observation-time semantics and fallback state.
4. One real event traverses observation → immutable evidence → candidate → explicit Reality admission → SpatialContext → Ask Jhadina/DELIA, with durable rows independently verified.
5. Stale/outage/malformed/fallback/conflict/duplicate/insufficient-corroboration live drills fail closed.
6. Licensing/privacy runtime enforcement is proven, including restricted model-input sources and no face/named-person/plate tracking path.
7. Director, DELIA, JANET, Safety, Money/SHARK, Sports, Opportunity, Research and Media consume Spatial context as intelligence only.
8. Provider health, evidence writes, source failures, Reality admissions, policy denials and workspace replay are observable in production, and interruption recovery is tested.
9. Spatial Conformance + health + live E2E are rerun on the deployed SHA and the final certification receipt is frozen.

## Final gate rule

`PASS` requires evidence tied to the deployed production lineage. `UNKNOWN`, `BLOCKED`, source-only tests, and historical deployments are never promoted to production success.

**GEV-P1 through GEV-P10 are source-complete. GEV-PROD.FINAL remains BLOCKED / FAIL-CLOSED.**
