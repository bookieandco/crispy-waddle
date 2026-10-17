# GEV-LIVE.11–.14 — Fail-closed source closeout and production certification boundary

Date: October 16, 2026 (America/Los_Angeles).
Status: **Source implementation / source CI pending on this exact PR. Live production certification BLOCKED.**

## Dependency and mainline reconciliation

- GEV-PROD-REPAIR.04–.11: PR #1293 merged as `3b746398113e217a8f60c4c4e5128237061131c5`.
- GEV-LIVE.01–.03: PR #1296 merged as `0f9040e0a93003379533112d6eb157b1e523e820`.
- GEV-LIVE.04–.07: PR #1300 merged as `89b5bba2cd9e0e8ecb8a41d2b090a982d68ac0c8`.
- GEV-LIVE.08–.10: PR #1338 `6e083d72376f103c690f9ab7ecaf5a37d542e79c` with Spatial Conformance passing (14/14 Vitest, 60/60 TAP, 49/49 Web tests). Broader workflows must be verified and predecessor merged first.
- This branch is stacked directly on #1338. Preserve all unrelated mainline commits; do not reconstruct an alternate Reality, deploy an unverified fork, or bypass review.
- Vercel project `crispy-waddle-jhadina-web` has READY deployments but no independently verified GEV-LIVE.11–.14 deployment. Its user-managed env listing did not include GEV host, approval flags, or manual canary enablement. READY deployment is **not** a GEV certification.
- Protected Supabase service-role RLS/grants were previously checked but **not** a real signed production OIDC request-context receipt; production must independently verify identity and readback.

## .11 Adversarial/privacy

- Production Spatial health requires the same HTTPS exact hostname + explicit camera commissioning flag used by the canonical GEV source gateway. An arbitrary server environment URL cannot trigger a health probe.
- Ask model-input USGS summaries avoid raw provider-supplied free text (e.g. `place`) and use only bounded, numeric/identifier observations. Stale/future records cannot represent present conditions.
- Negative tests: unapproved host, stale/future observation, malicious place/attribute text and source restrictions. Existing suites also cover denied CCTV model-input, ineligible fallback cameras, malformed upstream schemas, large responses, owner identity, and unsupported domains.
- Remaining deployment defense: independently verify DNS/egress and prohibit RFC1918/metadata access from the hosting network; string hostname validation alone cannot stop DNS rebinding. Provider terms/rights remain an external prerequisite. No policy-sensitive feed is auto-enabled.

## .12 Idempotent restart/failure recovery

- Identical immutable Evidence replay now derives candidate/admission creation time from the original **recorded evidence receipt timestamp**, not from the current retry clock. This enables equality of rows on an identical-evidence duplicate after a worker restart, preserving append-only duplicate semantics.
- Tests cover repeat append/readback with one admission identity, an upstream outage that cannot certify, recovery after upstream resumes, DB-readback interruption and later recovery.
- Re-fetching the same upstream record at a **new received-at instant** deliberately produces a distinct Evidence envelope; it is **not** claimed globally deduplicated. No always-on host or real cross-deployment restart drill exists in this PR.
- Live recovery under credential revocation, service restarts, packet loss and source outage still requires owned deployed host receipts, not synthetic tests.

## .13 Controlled deployment boundary

- No production deploy/promotion, source credential, OIDC grant, auto-run cron, database migration or paid service is performed by this PR.
- Owner-authenticated `GET /api/spatial/certification` is a no-store, **read-only preflight**. It cannot trigger the mutable USGS canary, elevate privileges, change env vars, or self-generate a PASS.
- The independent gate requires an actual owner-authenticated JSON health response, same exact 40-hex commit SHA as the Vercel production deployment, approved source rights/network, six verified tables, and independently verified durable USGS canary.
- If those are missing, `status=BLOCKED`. GitHub CI, a Vercel READY marker, a login-page HTML response or mocked data cannot replace them.

## .14 Final acceptance semantics

- `evaluateGevLiveCloseout` emits the versioned `GEV_LIVE_CLOSEOUT_V1` ten-gate ledger with deterministic reason codes and `blockedOn` identifiers for production deployment, same SHA, JSON owner health, provider rights, privileged OIDC, real canary, admission readback, restart, failure drills and owner review.
- Even an all-green input yields **READY_FOR_INDEPENDENT_REVIEW**, with `productionCertified=false`, **never** automatic PROD PASS. A production certificate requires independent verification of actual artifacts outside this unprivileged source function.
- Required final external evidence: exact deployed SHA and URL/ID, authenticated health JSON, owner session verification, provider and license/egress approvals, real receipt containing evidence hash plus candidate/admission IDs, independent readback across the six protected tables, source provenance, live outage/idempotent-restart/identity-denial/tamper drills, and owner sign-off.
- Do **not** mark SPATIAL-16 or GEV-LIVE.FINAL as production-certified until those are actually observed and reviewed on the **same** deployment.

## Recommended acceptance order when the external conditions exist

1. Inspect GitHub PR exact-head CI, and merge only when every required workflow passes.
2. Confirm a real deployment at that exact head and that its protected JSON endpoints are genuinely authenticated; avoid HTML redirect false-positives.
3. Confirm real HTTPS provider identity, source terms, egress allowlists and server-only flags; never enable rights-restricted sources by default.
4. Verify the production OIDC principal and read-only six-table accessibility without changing existing RLS.
5. Explicitly owner-authorize and execute one **real**, non-synthetic USGS canary; inspect its hash, Evidence, candidate and admission **via independent database readback**.
6. Run controlled authorized live outage/restart/replay/tamper drills and compare all hashes, timestamps, IDs and status receipts.
7. Record owner approval and independent reviewer verdict. Until then release status is **BLOCKED**.

**Source-only CI fixtures and in-memory stores are NOT production evidence.**
