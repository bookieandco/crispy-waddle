# GEV-LIVE.04–.07 — Commissioned provider and manual evidence canary

**State: source under review; production commissioning and genuine end-to-end evidence NOT YET DONE.**

## Baseline
- GEV-PROD-REPAIR .04–.11 was merged via PR #1293 (`3b746398`).
- GEV-LIVE.01–.03 was merged via PR #1296 (`0f9040e0a93003379533112d6eb157b1e523e820`).
- This change continues the **same** Spatial policy, `GevProviderBridge`, Evidence store, Reality candidate/admission and OIDC privileged gateway. No new persistence tables, container service, billing or unsupervised worker.

## .04 Explicit commissioned upstream

The existing owner-controlled `JHADINA_GEV_BASE_URL` (or legacy `GEV_BASE_URL`) can only be exercised by the source gateway for approved domains when all of the following are satisfied:
- `JHADINA_GEV_APPROVED_HOSTNAME` matches exactly the HTTPS origin's host. No bare IP, localhost/private alias, URL path, credentials, redirects or ports.
- The matching `JHADINA_GEV_APPROVE_CAMERA`, `JHADINA_GEV_APPROVE_AIRCRAFT`, `JHADINA_GEV_APPROVE_VESSEL`, or `JHADINA_GEV_APPROVE_FIRE` is exactly `true`.
- The purpose-specific existing source registry separately allows the requested use; e.g. CCTV/aircraft/AIS model-input remains denied. A valid origin/approval cannot override source-policy denials.
- Server egress/DNS must independently restrict internal network destinations to mitigate DNS rebinding. Application hostname checks are defense-in-depth, **not** an external-network firewall or proof of source rights.
- GET reads use explicit allowlisted GEV API paths, no redirects, JSON content type, 512 kB limit, 5-second upstream request timeout, bounded output. No arbitrary destination or raw response is forwarded.
- Catalog-only CCTV remains non-admissible; missing approvals, wrong content type, failed schema, disconnected sources and unknown rights are `DENIED`/`UNAVAILABLE`.

**Important:** There is currently no evidenced external GEV host or domain-rights approval. Do not set any approve flag until the real provider, rights and network controls have been checked. This commit configures **no** production secrets or hosts.

## .05 Privileged Supabase commissioning
- `probeGevLiveCanaryTables` checks **all six** existing Spatial/Knowledge tables using `createRuntimeServiceRoleClient` (existing OIDC service proxy or approved server-only direct service-role configuration).
- This is a read-only gate. It does not prove a signed claim's exact project context by itself; for live certification, inspect verified Vercel project/issuer/audience, proxy authorization and exact SHA separately.
- A missing/denied table or privileged client means **IDENTITY_UNAVAILABLE**, no provider request and no data mutation.
- The live database has RLS enabled and `service_role` SELECT/INSERT but no UPDATE/DELETE on the six tables. No RLS relaxation or new policy is part of this increment.

## .06/.07 Real-source evidence -> Reality readback

Manual route: `POST /api/spatial/live-canary`, protected by the existing user/session verifier, and requires this exact body:

```json
{"confirm":"RUN_ONE_AUTHORIZED_USGS_CANARY"}
```

Additional server-only gate: `VERCEL_ENV=production` **and** `JHADINA_GEV_LIVE_CANARY_ENABLED=true`. There is no GET mutation, cron, autonomous execution, or client override for this flag.

The canary reads **one** real USGS earthquake observation (no synthetic fallback and no satellite-derived geographic position), checks observed-vs-received timestamps and freshness, creates a canonical content-hashed evidence envelope using the **existing** `observationToEvidence`, performs append and independent readback, runs the **existing** `createSpatialRealityAdmissionReadProvider`, and independently reads back the candidate and admission. A result is `VERIFIED` only when all required readbacks and the actual accepted admission match. Missing identity, stale sources, malformed data, conflicting writes and failed readbacks yield explicit non-success without revealing provider/database error payloads.

The receipt records only source IDs, hashes, candidate/admission IDs, counts, decision, deployment SHA and fixed reason codes; it is **not** in itself evidence that a live canary has executed. Tests use in-memory stores and fixture USGS data and MUST NOT be labeled live production acceptance.

## Owner-required live certification
1. Verify the upstream GEV host, HTTPS TLS identity, DNS/egress enforcement and each provider's terms.
2. Verify app production auth and exact Vercel source SHA; do not treat a login-page HTTP 200 as a working JSON API.
3. Verify Vercel production OIDC project/team/audience in the existing project-local service proxy, plus all six table privileges.
4. Only when approved, configure required server-only environment variables. No new charges.
5. Run one **explicitly authorized** USGS-only canary, capture the actual response and independent database reads. A mock PASS is not a receipt.
6. Verify stale/duplicate/tamper/replay/outage behavior on the exact deployed SHA, and independent source provenance with no active surveillance.
7. Proceed with GEV-LIVE.08–.14 only after certified source-to-Ask path and recovery gates.

**No live canary was executed by this PR. No real provider data was persisted. No production-ready claim is warranted.**
