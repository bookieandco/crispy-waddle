# GEV-LIVE.08–.10 — Read-only Ask, Spatial World and cross-system acceptance

Date: 2026-10-16. **Source implementation only; not live E2E certified.**

## Canonical baseline
- GEV-LIVE.01–.03 merged as PR #1296 (`0f9040e0a93003379533112d6eb157b1e523e820`).
- GEV-LIVE.04–.07 merged as PR #1300 (`89b5bba2cd9e0e8ecb8a41d2b090a982d68ac0c8`) after exact-head conformance and broader repository CI passed.
- Source-only CI does **not** prove the owner-authenticated Vercel deployment, provider rights, privileged Supabase OIDC, or production USGS durable readback.

## .08 Ask Jhadina read-only observational context
- `createProductionSpatialContextProvider` still calls the **same** canonical `createGevSpatialContextReadProvider` and `createSpatialRealityAdmissionReadProvider` for existing durable evidence and Reality.
- A narrow `createGevLiveObservationReadProvider` supplements it **after** admission with read-only USGS earthquake observations from the existing source gateway. This adapter does not append Evidence, submit candidate/admissions or pretend a reference is immutable.
- Only when `plan.domains` includes earthquake: no new outside requests for other Ask topics. The daily feed is bounded, policy-filtered, scoped by validated radius/box and temporal range, cannot serve retrospective as-of states, and indicates that incomplete coverage is not proof of no events.
- The previous direct GEV bridge initialized from a bare `GEV_BASE_URL` in the production model-input composition was removed: simply setting a provider URL can no longer bypass the explicit rights gates introduced in .04. Uncommissioned camera, aircraft, vessel and FIRMS sources remain unavailable in the owner-only source gateway.
- Observation IDs and source summaries are kept separate from actual read-backed Evidence and admitted Reality in the canonical context. It does **not** certify live source freshness or production persistence.

## .09 Spatial World
- Existing Spatial Workspace retains owner-authenticated `/api/spatial/context`, revision snapshots, its evidence and admitted Reality references, and the Ask route.
- Source gateway status is read independently using authenticated `POST /api/spatial/source-gateway`; an AVAILABLE provider/catalog never implies an active video feed, persistent evidence or Reality acceptance.
- Add earthquake layer, bounded per-source status/attribution/limitations, separate observation and admitted Reality lists and timeline.
- Blank coordinates are not silently interpreted as (0, 0). Invalid/unconfigured source statuses are visible.
- Existing replay restores workspace selection metadata and should not be mistaken for a historic source replay; full temporal provenance and mobile device acceptance remain follow-on.

## .10 Cross-system safe handoff contract
- `projectSpatialReadOnlyHandoff(context, consumer)` is a pure, bounded reference-only projection for DELIA, Director, Safety, Money, Sports, Opportunity and Research.
- It exports **no** raw positions, stream URLs, credentials or media. It explicitly grants zero action, writing, publishing, private-feed, trade or wager privileges; IDs for raw observations, durable Evidence and admitted Reality remain separate.
- There is **no** activation of those external consumers or any unattended action loop in this PR. Per-consumer tests verify no privilege escalation.

## Gate status
- Exact-head Spatial Core + Web type-check, Spatial tests, and targeted Web tests must pass on this PR.
- Production gateway host approval remains absent; no provider license flags were enabled; no paid service was started; no user/private feed was scanned.
- Real owner-authenticated browser/device evidence, readback canary, outage/rollback drills and full SPATIAL-16 signed acceptance remain required under GEV-LIVE.11–.14.
- Do **not** declare this GEV integration production READY based on mocked fixture tests.
