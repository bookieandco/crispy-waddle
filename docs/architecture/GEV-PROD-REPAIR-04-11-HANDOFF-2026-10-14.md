# GEV-PROD-REPAIR.04–.11 — source repair, live commissioning, and certification handoff

Date: 2026-10-14 America/Los_Angeles. Authority: source-controlled, never self-certify production from this document.

## Status / provenance

- **Code changes:** PR #1293 (draft); branch `fix/gev-prod-repair-04-11-20261014`, based on `cd11cad87247d2153bb8a093b22a829b0c8620f1`.
- **Offline CI:** Spatial Conformance GitHub workflow on PR-head `ca03f1b12d2aed3125be56ff8bb7d170d71aa31e`, run `38687004488`, passed: frozen install, core type-check, core conformance, targeted Jhadina Web health/OIDC tests. This is **source evidence only**.
- **Live Vercel:** project `prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco`, production alias `crispy-waddle-jhadina-web.vercel.app`. Observed production deployment `dpl_PkwpM4a8rYE1jXotq24SkuNpicVa` at `770afae3cf48784d01f10a40e0884c752b281913` is READY as an application deploy, not this GEV repair.
- **Live Supabase:** project `kqbkaozfjubkjevdfvic` has six protected append-only Spatial/Knowledge tables; all six had zero rows at last read-only observation.
- **Provider backend:** no owner-controlled hosted GEV service/allowlisted public base URL was found in connected Vercel or Railway resources; Vercel user-managed environment had no `GEV_BASE_URL` / `JHADINA_GEV_BASE_URL`.
- **Privacy:** upstream GEV `/api/cctv/health` records only cameras exercised; an empty valid `{cameras: []}` at cold start is not a backend outage and never establishes live camera availability.

## Source implementation and gate ledger

| Gate | Source evidence | External condition | Disposition |
| --- | --- | --- | --- |
| REPAIR.04 Provider discovery | GEV bridge and strict CCTV envelope; explicit same-origin GET paths | identify a genuinely hosted upstream service with allowed data rights and an operator | BLOCKED_EXTERNAL |
| REPAIR.05 Runtime config | `JHADINA_GEV_BASE_URL` / `GEV_BASE_URL` input; no hardcoded URLs or secrets | safely configure real backend and production project identity through approved settings | BLOCKED_EXTERNAL |
| REPAIR.06 Persistence | Evidence/Reality/Knowledge/Workspace request-context OIDC fallback; fail-closed tests | authenticated read/write/readback to actual protected tables under correct Vercel OIDC | SOURCE_PASS / LIVE_BLOCKED |
| REPAIR.07 Health | six schema-neutral read checks, transport/source-use distinction, cold-start/fallback/malformed tests | owner-authenticated JSON `/api/spatial/health` on deployed SHA | SOURCE_PASS / LIVE_BLOCKED |
| REPAIR.08 Deployment | draft PR; source CI pass | reviewed, green and no-cost preview/deploy + SHA/alias evidence | BLOCKED_EXTERNAL |
| REPAIR.09 End to end | source-only evidence/Reality admission/Ask path exists | real provider -> observation -> durable evidence -> candidate -> admission -> Ask receipt | BLOCKED_EXTERNAL |
| REPAIR.10 Safety/recovery | restrictions, deny-by-default, offline adversarial tests | production policy denial, outage/stale/fallback/duplicate/tamper/restart drills | BLOCKED_EXTERNAL |
| REPAIR.11 Certification | SPATIAL-16 acceptance criteria | independent same-SHA evidence for all earlier gates | BLOCKED / FAIL-CLOSED |

### Commissioning steps — do not skip

1. Record backend ownership, source revision/commit, HTTPS origin, hosting plan/cost and source-use permissions. Do **not** assume the original `bilawalsidhu/gods-eye-view` is deployed, or confuse a local MCP app with a remote service. No account upgrade, purchased service, billing change or unmanaged third-party URL is authorized by this handoff.
2. Test upstream `GET /api/cctv/health` and `GET /api/cctv/sources` separately. Confirm 200 JSON with expected schemas, TLS, timeouts and camera provenance. An empty health list may be a legitimate cold start; a populated source catalog does **not** imply a working live camera. For each domain, test permitted live source data separately.
3. Bind the verified upstream URL to the correct Jhadina Web Vercel environment using the provider's guarded project configuration. Keep service secrets in their protected provider only. Do not commit environment values or publish tokens in logs, artifacts or PRs.
4. Prove production requests can obtain a privileged Supabase client with the intended Vercel OIDC project/team claims. Independently confirm six tables and `service_role` SELECT/INSERT only; no `anon`/`authenticated` grants and no UPDATE/DELETE. A server gateway existing or being ACTIVE is not a successful authorized request.
5. After reviewed CI is green and costs/capacity are acceptable, deploy a **preview** tied to the PR SHA. Confirm exact project and deployment SHA and obtain an authenticated JSON health response. A redirect to `/login`, HTML 200, or a generic Vercel READY state fails this check; do not weaken application auth or reuse deployment bypass as user auth.
6. Run a controlled no-person-tracking canary with authorized source data. Persist one real observation with source/terms/record ID/observed and received timestamps/coverage/quality/hash. Read it back and verify the hash. Produce and read back a candidate, an explicit ACCEPT/DEFER/REJECT admission with rationale, and the actual Ask Jhadina bounded context and usage receipt. If admission is DEFER, that is a legitimate safe result; do not manufacture ACCEPT.
7. Run permitted source-specific provenance for CCTV, aircraft, vessel, FIRMS; obtain error/denial/fallback evidence without leaking raw images, precise private location or third-party identifiers. Confirm policy denies restricted model-input feeds and no source execution path.
8. Exercise outage, cold start, stale, malformed, fallback-only, identical replay, conflicting hash/identity, competing sources, database error, process restart and recovered source. Each fail-closed case must preserve no raw-to-Reality promotion. Verify bounded telemetry and replay provenance.
9. Obtain repeated live receipts tied to the **same deployed commit**. Only after everything is independently verified and no critical failure remains may SPATIAL-16 / REPAIR.11 change to PASS.

### Read-only database checkpoint (no migration or mutation)

```sql
SELECT 'evidence' AS component, COUNT(*) AS records FROM public.jhadina_spatial_evidence
UNION ALL SELECT 'reality_candidates', COUNT(*) FROM public.jhadina_spatial_reality_candidates
UNION ALL SELECT 'reality_admissions', COUNT(*) FROM public.jhadina_spatial_reality_admissions
UNION ALL SELECT 'workspace_revisions', COUNT(*) FROM public.jhadina_spatial_workspace_revisions
UNION ALL SELECT 'knowledge_nodes', COUNT(*) FROM public.jhadina_knowledge_nodes
UNION ALL SELECT 'knowledge_relations', COUNT(*) FROM public.jhadina_knowledge_relations;
```

These counts prove existence of records but **not provenance, admission correctness, or that a real upstream was used**. The external test ledger must cross-reference immutable ids/hashes, source receipts, admitted decision and exact deployment SHA. No invented records, unauthenticated public-health bypass or synthetic PASS.

## Final disposition

**REPAIR.04–.07: source changes landed on a draft review branch and offline targeted CI passed.** **REPAIR.08–.11: externally blocked/unknown** because upstream production configuration, authorized live acceptance and exact-SHA deployment evidence are missing. This document intentionally does not flip SPATIAL-16 to PASS.

Links: [PR #1293](https://github.com/bookieandco/crispy-waddle/pull/1293), [Spatial-16 readiness](../SPATIAL-16-READINESS.md), [2026-09-20 certification audit](GEV-PROD-certification-audit-2026-09-20.md).
