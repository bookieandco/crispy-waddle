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

**SOURCE AUDIT PASS; LIVE ADVERSARIAL DRILLS BLOCKED BY PROD.1 / PROD.4.**

**2026-09-20 PROD.5 continuation audit:** adversarial source coverage was re-audited across admission, evidence persistence, provider degradation and replay/idempotency boundaries. Missing referenced evidence defers admission. Synthetic/fallback-only and Street View fallback-only candidates defer. Stale evidence is rejected from the fresh-evidence requirement by the PROD.4/P10 admission coverage. A provider exception is captured as unavailable/degraded source health plus structured source-failure telemetry instead of invented observations. Evidence with a non-canonical/tampered content hash is rejected; reusing an evidence ID with different content raises an ID conflict. Identical evidence is idempotent/duplicate-safe. Candidate and admission stores are append/conflict-safe, and the Supabase adapters verify persisted duplicate content rather than silently accepting an ID collision.

The read/admission boundary also catches persistence/admission exceptions per evidence item, records a failed-closed limitation and telemetry, and does not emit an accepted Reality ref for the failed item. Context assembly copies provider-owned arrays, preventing downstream mutation of the provider result.

**Remaining production drills:** after PROD.1 deployment, execute live fault injections/controlled failure cases for provider outage, stale payload, fallback-only CCTV, evidence write/read failure, candidate/admission persistence failure, duplicate replay, and tampered/conflicting receipt behavior. Capture sourceHealth, limitations, telemetry and Supabase row receipts on the exact deployed SHA. No UNKNOWN/BLOCKED case may be promoted to PASS.

### GEV-PROD.6 — privacy/licensing runtime test

**SOURCE AUDIT PASS; LIVE RUNTIME BLOCKED BY PROD.1.**

**2026-09-20 PROD.6 continuation audit:** source-policy enforcement is purpose-specific and fail-closed. Private read-only analysis is the only unconditional policy purpose; commercial analysis, publication, model input, replay and redistribution require an explicit `allowed` disposition. `restricted` and `unknown` dispositions deny use. Every normalized evidence record embeds source policy metadata including attribution, terms reference, privacy class, use dispositions and provider limitations, preserving the policy context with the evidence lineage.

CCTV is classified `public-incidental-personal`; its registered limitations explicitly prohibit named-person search, face recognition, individual tracking and plate identification. CCTV model input is `restricted`, so the perception gate rejects it before calling the model adapter. For sources whose model input is allowed, incidental-personal data additionally requires an explicit approval bit, and every model result remains `INFERRED` with `canonicalReality: false`.

OpenSky commercial use is restricted; AISStream rights beyond private analysis are unknown; TomTom replay/redistribution/retention are restricted; OSM and adsb.lol preserve ODbL attribution/share-alike limitations; FIRMS and USGS preserve provider attribution/source-time constraints. Unknown provider rights therefore cannot silently become commercial/publication/replay authorization.

Database hardening also revokes all spatial table access from `anon` and `authenticated`, and limits `service_role` to SELECT + INSERT on the six append-only Spatial/Knowledge Graph tables, preventing UPDATE/DELETE/TRUNCATE through the production runtime role.

No additional PROD.6 source defect was found. **Certification boundary:** live policy-denial telemetry, source-specific attribution/terms receipts and database privilege enforcement still require verification on the exact deployed SHA after PROD.1. Source audit PASS does not promote PROD.6 runtime status to PASS.

### GEV-PROD.7 — cross-Jhadina live integration

**SOURCE AUDIT PASS; LIVE RUNTIME BLOCKED BY PROD.1.**

**2026-09-20 PROD.7 continuation audit:** the cross-Jhadina projection boundary is explicit and capability-limited. Money, Sports, Opportunity, Courier, Safety, Research and Media all receive copied Spatial evidence/Reality/observation refs under `authority: INTELLIGENCE_ONLY`; every projection carries the invariant that Spatial context cannot authorize actions in the consuming subsystem. Their prohibited-use sets explicitly block trade execution/spatial-signal orders, auto-betting, automatic outreach, automatic dispatch/approval bypass, named-person surveillance/face recognition/plate identification/individual tracking, raw-source-to-Reality promotion and publication without a rights check.

JANET can modify presentation/workspace preferences only and copies evidenceRefs/realityRefs unchanged. DELIA produces reasoning/assessment with `INTELLIGENCE_ONLY` authority. MARISA can prepare a consequential-operation proposal, but it is always emitted as `REQUIRES_POLICY_APPROVAL` with `approved: false` and receives no executor or approval authority.

The Safety bridge is read-only: Spatial records become Safety context signals and preserve evidence class distinctions, while the core interface states that Spatial context may inform policy inputs but cannot authorize actions. Safety-specific consumer restrictions additionally prohibit person/face/plate/individual tracking uses.

No source path audited here grants a Spatial consumer truth-mutation or execution authority. No additional PROD.7 source defect was found. **Certification boundary:** live cross-subsystem receipts still require the current Spatial lineage to deploy; source audit PASS does not make PROD.7 a runtime PASS.

### GEV-PROD.8 — telemetry/recovery

**SOURCE AUDIT PASS; LIVE RECOVERY BLOCKED BY PROD.1.**

**2026-09-20 PROD.8 continuation audit:** Spatial telemetry has explicit event classes for provider health, source failure, evidence writes, Reality admission, policy denial and workspace replay, with stable statuses covering healthy/degraded/failed, denied, accepted/deferred/rejected/superseded and replay/miss outcomes. Telemetry is observational only: sink exceptions are swallowed and therefore cannot mutate or relax evidence, policy or Reality decisions. Error reporting is reduced to bounded low-cardinality error codes rather than raw provider/database exception details.

The production sink attaches Vercel environment and `VERCEL_GIT_COMMIT_SHA` to every structured event while intentionally excluding raw observations, provider payloads, user IDs, secrets and model inputs. This provides the deployment identity needed to bind operational receipts to the exact certified SHA without turning telemetry into another sensitive-data store.

The production health endpoint is dynamic and no-store. It performs an actual provider reachability check plus read-only reachability checks across all six Spatial/Knowledge Graph tables. It returns `READY`/HTTP 200 only when the provider and complete database surface are configured and reachable; any missing/unreachable side yields `DEGRADED`/HTTP 503. The response exposes only booleans, timestamp, environment and deployed commit SHA—not provider URLs, credentials or row data.

Provider/evidence/admission failures remain degraded/fail-closed and later successful requests can demonstrate recovery without changing the truth-policy gates. No additional PROD.8 source defect was found. **Certification boundary:** after PROD.1, run controlled provider and database interruption/recovery drills and capture health transitions plus telemetry/log receipts tied to the exact deployed SHA. Until those live receipts exist, PROD.8 runtime remains BLOCKED.

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
