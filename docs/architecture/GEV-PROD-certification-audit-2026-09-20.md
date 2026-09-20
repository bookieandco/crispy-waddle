# GEV-PROD production certification audit — 2026-09-20

Status: **BLOCKED / FAIL-CLOSED**

This document records the live production-certification audit after GEV-P1 through GEV-P10, the spatial persistence migrations, security hardening and source conformance work.

## Certification invariant

Production certification requires live evidence. Source completeness, passing conformance tests, an installed schema, or an old READY Vercel deployment are not substitutes for a live receipt on the deployed Spatial lineage.

Canonical truth path:

`GEV/source -> SpatialObservation -> immutable SpatialEvidence -> claim candidate -> explicit Reality admission -> SpatialContext -> Ask Jhadina / governed consumers`

A raw observation must never skip directly to Reality.

## Live audit evidence

### Git / deployment

- The handoff baseline `5947f13...` is no longer the repository head. Main continued to advance after that point.
- The active production alias still resolves to Vercel deployment `dpl_GhzhDUFagdyGABQmuZPLNNpS4sLA` at commit `dee990b6c5d8d8d8836d7eb9ef706f2656e913ce`.
- That deployment predates the Spatial/GEV production runtime.
- PR #311, PR #376 and PR #380 all recorded Vercel deployment failure code `api-deployments-free-per-day` (more than 100 deployments/day).
- No READY deployment from the audited GEV merge lineage was found that can be promoted in place.
- Recent unrelated main deployments may be CANCELED by Vercel's monorepo "skipping unaffected projects" behavior; that does not move production onto the Spatial lineage.

### Live Supabase

Project `kqbkaozfjubkjevdfvic` is ACTIVE_HEALTHY.

The six Spatial/Knowledge Graph tables exist with RLS enabled:

- `jhadina_spatial_evidence`
- `jhadina_spatial_reality_candidates`
- `jhadina_spatial_reality_admissions`
- `jhadina_spatial_workspace_revisions`
- `jhadina_knowledge_nodes`
- `jhadina_knowledge_relations`

A live drift check found `service_role UPDATE` still granted on the two Knowledge Graph tables even though the committed migration defines the graph as append-only. The live grants were repaired during this audit. Both Knowledge Graph tables now expose only `SELECT, INSERT` to `service_role`, matching the committed contract. Client roles remain denied.

All six tables currently contain zero rows. Therefore no live production GEV event has yet established an end-to-end persistence/admission receipt.

## Runtime audit findings

### GEV-PROD.1 — current production deployment

**AUDIT/REPAIR — BLOCKED / FAIL-CLOSED.** Vercel is explicitly tracked as an infrastructure audit/repair item and is not allowed to block source/runtime repair work on later GEV gates. The production certification gate itself remains blocked: the build-rate limit is active and production remains on `dee990b6...`. No later source-code PASS may be interpreted as a deployed-production PASS until Vercel is repaired and the current Spatial lineage is live.

### GEV-PROD.2 — production health gate

**BLOCKED BY PROD.1.** The current source health endpoint is fail-closed and requires:
- configured/reachable GEV provider;
- all six database checks reachable;
- response status `READY`.

The active production deployment predates this route, so it cannot certify the current runtime.

### GEV-PROD.3 — live-source verification

**BLOCKED BY PROD.1, plus one runtime-evidence gap.**

The bridge allowlists the expected GEV endpoints for CCTV, OpenSky aircraft, AIS vessels, FIRMS, TomTom and CelesTrak. Source policy metadata carries attribution/licensing/privacy/use restrictions.

CCTV catalog normalization preserves provider identity, source ID, feed/source kind, license and credit. However:
- CCTV catalog observations intentionally have `observed_at = null`; and
- the current read provider does not merge per-camera `/api/cctv/health` state into normalized observations.

Upstream GEV tracks `status`, `sourceKind` and `updatedAt` per camera and explicitly distinguishes upstream/snapshot/live/Street View/synthetic fallback. PROD.3 must not be marked PASS until the live receipt proves observation-time semantics and fallback state survive the normalization/certification path.

### GEV-PROD.4 — true live E2E Reality path

**NOT CERTIFIABLE YET.**

The GEV Spatial read provider intentionally emits observations + immutable evidence and returns empty `claims[]` / `reality[]`. This correctly prevents self-admission.

The repository contains candidate/admission evaluators and durable reality stores, but this audit did not find a deployed-facing Jhadina Web composition that carries one live GEV event through candidate creation and explicit Reality admission. A certification-only/live composition is required to prove:

`observation -> evidence -> candidate -> admission -> SpatialContext -> Ask Jhadina/DELIA`

without creating any raw-observation-to-Reality bypass.

### GEV-PROD.5 — adversarial live drills

**BLOCKED BY PROD.1 / PROD.4.** Source tests cover stale/outage/fallback/duplicate/corroboration behavior, but production drills still require deployed live receipts.

### GEV-PROD.6 — privacy/licensing runtime test

**SOURCE BOUNDARY PASS; LIVE RUNTIME BLOCKED.**

The source policy registry fails closed for restricted/unknown uses and explicitly prohibits CCTV named-person search, face recognition, individual tracking and plate identification. Safety configuration separately hard-disables named-person search, face recognition and plate identification. Live enforcement still requires deployed runtime evidence.

### GEV-PROD.7 — cross-Jhadina live integration

**SOURCE BOUNDARY PASS; LIVE RUNTIME BLOCKED.**

DELIA is intelligence-only. JANET is presentation/workspace-only. Spatial consumer projections for Money, Sports, Opportunity, Safety, Research and Media are `INTELLIGENCE_ONLY` and do not grant ActionExecutor authority. Director receives provider-neutral Spatial capabilities; consequential execution remains on the existing policy/approval/ActionExecutor path.

Live cross-subsystem receipts still require the current deployment.

### GEV-PROD.8 — telemetry/recovery

**NOT CERTIFIABLE YET.**

Vercel runtime logs for the active production deployment contain no current Spatial activity because production is still on the pre-Spatial build. This audit also did not find dedicated Spatial production telemetry for all required events (provider health, evidence writes, source failures, Reality admissions, policy denials and workspace replay). PROD.8 requires observable live receipts plus provider/database interruption recovery.

### GEV-PROD.FINAL

**BLOCKED / FAIL-CLOSED.**

Do not freeze a PASS receipt until all of the following are tied to the same deployed Spatial production lineage:

1. production alias on the audited/current Spatial lineage;
2. `/api/spatial/health == READY`;
3. live CCTV + aircraft + vessel + FIRMS verification with preserved provenance/time/fallback/licensing identity;
4. a true live observation-to-explicit-Reality-admission receipt with rows verified in Supabase;
5. adversarial fail-closed drills;
6. live privacy/licensing enforcement;
7. cross-Jhadina intelligence-only integration receipts;
8. production telemetry and recovery receipts;
9. final Spatial Conformance rerun on the deployed SHA.

No UNKNOWN or BLOCKED item may be promoted to PASS.
