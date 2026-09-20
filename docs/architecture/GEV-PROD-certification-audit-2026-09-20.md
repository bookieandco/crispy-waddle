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

**AUDIT/REPAIR — BLOCKED / FAIL-CLOSED.**

**2026-09-20 lockfile repair marker:** the prior Vercel deployment-rate blocker cleared far enough for a fresh build attempt. The current concrete blocker is `ERR_PNPM_OUTDATED_LOCKFILE` during `pnpm install`. The repository uses a shared workspace lockfile (`apps/*`, `packages/*`, `infrastructure/*`), and the root pnpm package-extension state has advanced beyond the lockfile generation state. This is marked **AUDIT/REPAIR**. Required repair is to regenerate the complete shared `pnpm-lock.yaml` with the repository-pinned `pnpm@8.15.9`, then prove `pnpm install --frozen-lockfile` before redeployment. Do not bypass the frozen-lockfile gate and do not hand-edit resolution/checksum state. This external execution blocker does not authorize any PROD.2+ production PASS.
 Vercel is explicitly tracked as an infrastructure audit/repair item and is not allowed to block source/runtime repair work on later GEV gates. The production certification gate itself remains blocked: the build-rate limit is active and production remains on `dee990b6...`. No later source-code PASS may be interpreted as a deployed-production PASS until Vercel is repaired and the current Spatial lineage is live.

### GEV-PROD.2 — production health gate

**BLOCKED BY PROD.1.** The current source health endpoint is fail-closed and requires:
- configured/reachable GEV provider;
- all six database checks reachable;
- response status `READY`.

The active production deployment predates this route, so it cannot certify the current runtime.

### GEV-PROD.3 — live-source verification

**SOURCE AUDIT PASS; LIVE RUNTIME BLOCKED BY PROD.1.**

**2026-09-20 PROD.3 continuation audit:** re-audited the production composition on current main. The production provider instantiates the allowlisted GEV bridge, durable Supabase evidence store, Knowledge Graph sink and telemetry sink. The live read path requests CCTV catalog + CCTV health, OpenSky aircraft, AIS vessel and FIRMS fire data concurrently. Normalization preserves provider/source identity, observation/receipt time, freshness/staleness semantics and immutable evidence provenance. CCTV explicitly records catalog source kind versus effective health source kind, provider health metadata, fallback-active state, timestamp semantics, license and credit. Source-policy metadata is embedded into durable evidence before downstream admission. Provider/source failures are surfaced as degraded sourceHealth/limitations and telemetry rather than converted into invented observations.

Source tests additionally exercise Street View fallback identity, stale OpenSky/AIS/FIRMS semantics and the rule that the evidence reader emits no claims or Reality by itself. No source-side defect justifying a PROD.3 code change was found in this audit.

**Certification boundary:** this is a source-audit PASS only, not a production-runtime PASS. PROD.3 remains BLOCKED until PROD.1 deploys the audited Spatial lineage and live receipts prove CCTV + aircraft + vessel + FIRMS provenance/fallback behavior on that exact deployed SHA.

The bridge allowlists the expected GEV endpoints for CCTV, OpenSky aircraft, AIS vessels, FIRMS, TomTom and CelesTrak. Source policy metadata carries attribution/licensing/privacy/use restrictions.

CCTV `/sources` and `/health` are now composed in the production read path. Normalized camera source-state evidence preserves provider identity, catalog and effective source kind, health status/label/message, upstream `updatedAt` timestamp semantics, fallback-active state, license and credit. Street View/synthetic/fallback state is explicit and remains evidence-only. PROD.3 still requires a deployed live receipt before PASS.

### GEV-PROD.4 — true live E2E Reality path

**SOURCE AUDIT PASS; LIVE RUNTIME BLOCKED BY PROD.1.**

**2026-09-20 PROD.4 continuation audit:** re-audited the complete production composition from normalized GEV observation through SpatialContext. The evidence reader first creates content-hashed immutable SpatialEvidence and, when Supabase is configured, appends it to `jhadina_spatial_evidence`. The governed admission provider then re-reads each evidence item from that durable store before candidate construction; raw observations have no direct admission input. It appends the candidate to `jhadina_spatial_reality_candidates`, evaluates explicit admission with required available + non-fallback + fresh evidence, appends the decision receipt to `jhadina_spatial_reality_admissions`, and exposes a Reality ref only for `ACCEPT`. Missing/unreadable evidence, incomplete candidate inputs, stale evidence and fallback-only evidence defer/fail closed rather than becoming Reality.

The production composition installs this governed layer only when both durable evidence and Reality stores exist; otherwise the provider remains evidence-only. The authenticated `/api/spatial/context` route consumes the resulting context and records evidenceRefs, activeClaimRefs and realityRefs in an append-only Spatial workspace revision when that store is available. Candidate/admission duplicate handling verifies persisted content before accepting idempotent duplicates.

Existing integration coverage proves the no-bypass invariant and explicitly verifies a fallback CCTV candidate is persisted with a `DEFER` admission while fresh non-fallback aircraft evidence can produce admitted Reality. No additional PROD.4 source defect was found in this audit.

**Certification boundary:** source composition PASS is not a live production PASS. PROD.4 remains BLOCKED until PROD.1 deploys the audited lineage and one authenticated live request produces matching Supabase evidence, candidate, admission and workspace receipts tied to that deployed SHA.

The GEV Spatial reader remains evidence-only and cannot self-admit. Production now wraps that reader with a separate governed promotion layer that re-reads durable evidence, appends a candidate, evaluates the explicit admission gate, appends an immutable admission receipt, and exposes Reality refs only for `ACCEPT`. Fallback-only evidence is deferred and production admission additionally requires explicitly fresh non-fallback evidence. Supabase now has a server-only append-only adapter for both reality tables.

The required chain is therefore represented in source as:

`observation -> durable evidence -> candidate -> explicit admission -> SpatialContext -> Ask Jhadina/DELIA`

A deployed live receipt with Supabase rows is still required before PROD.4 can PASS.

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

**SOURCE INSTRUMENTATION REPAIRED; LIVE RECOVERY BLOCKED BY PROD.1.**

Spatial now emits structured, observational-only telemetry for provider health, source failures, evidence writes, Reality admissions, policy denials and workspace replay. The production sink writes low-cardinality JSON events with deployment SHA/environment and intentionally excludes raw observations, source payloads, model inputs, user IDs and secrets. Telemetry sink failures are swallowed so logging cannot alter evidence, policy or Reality behavior. Provider and evidence-store failures remain fail-closed/degraded as before and subsequent requests can produce recovery-success events.

PROD.8 still requires the current Spatial lineage to be deployed, then a live provider interruption and database interruption/recovery drill with Vercel log receipts tied to that deployed SHA.

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
