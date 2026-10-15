# GEV-LIVE.01–.03 — canonical source gateway handoff

Status: **GEV-PROD-REPAIR dependency merged; LIVE.02–.03 source implementation under review; production NOT certified.**
Date: October 14, 2026 (America/Los_Angeles).

## Existing dependency / integration choice

- PR [#1293](https://github.com/bookieandco/crispy-waddle/pull/1293) was merged after its tested Spatial conformance and full recorded CI checks on head `53e6a95e9c1275687c154b917ab90f4ae43fb9a2`. Merge commit: `3b746398113e217a8f60c4c4e5128237061131c5`.
- This increment does **not** deploy or vendor `bilawalsidhu/gods-eye-view`, assume that its localhost APIs exist on the internet, or introduce a duplicate evidence/Reality database.
- It adds a small **owner-authenticated in-process Jhadina Web route** `POST /api/spatial/source-gateway`. It reuses the canonical Spatial source policy registry, observation adapters and existing public satellite reader.
- The endpoint is read-only, no-store at HTTP response, and produces source observations solely as intelligence. Its typed response declares `persisted: false` and `admittedReality: false`. It has no direct action, notification, publication or inference authority.

## Contract

Request (authenticated Jhadina owner session + `x-jhadina-user-id` consistency header, verified by the existing identity verifier):

```json
{"purpose":"model-input","domains":["earthquake","satellite","camera","aircraft","vessel","fire"]}
```

Domains are a strict allowlist. Purpose is exactly `model-input` or `private-analysis`. No client-provided URL, map API credential, precision location, arbitrary satellite group or raw provider payload can direct upstream HTTP.

Response: `kind: GEV_SOURCE_GATEWAY_V1`, `authority: INTELLIGENCE_ONLY`, `checkedAt`, `persisted: false`, `admittedReality: false`, per-source status, explicit source ID, bounded normalized `SpatialObservation[]`, attribution, terms reference and limitations.

## Actual backends in this increment

| Domain | Source identity | Handling |
| --- | --- | --- |
| Earthquake | `gev-usgs` | Read-only fixed USGS daily GeoJSON HTTPS GET, no redirects, timeout, bounded JSON byte limit, 24 newest source-list records maximum; normalized into canonical source/record/time/position/coverage/quality fields |
| Satellite | `gev-celestrak` | Reuses `createPublicSatelliteSpatialProvider` and its CelesTrak group/purpose/cache constraints; at most 12 normalized observations from stations group; estimated ground positions stay derived context, never admitted Reality |
| Camera | `gev-cctv` | `DENIED` for model input; `UNAVAILABLE` for private analysis until a properly licensed live CCTV service is commissioned |
| Aircraft | `gev-opensky` | `DENIED` for model input by existing source policy; `UNAVAILABLE` for private analysis until provider credentials/licensing and operational source are commissioned |
| Vessel | `gev-aisstream` | `DENIED` for model input (unknown rights); `UNAVAILABLE` for private analysis until an AISStream live relay with authorized access is commissioned |
| Fire detections | `gev-firms` | `UNAVAILABLE` until NASA FIRMS MAP_KEY/rights and real feed are commissioned; no alternative event feed is misrepresented as FIRMS |

USGS/CelesTrak endpoints are real public-provider addresses, but this branch's CI mocks transport. Actual production connectivity, freshness and terms compliance still need live receipts. The shared satellite reader's 2-hour cache lives within a warm instance; serverless cold starts are not a durable global caching guarantee.

## Safety and test gates

- Hard-coded USGS source URL, request redirect denied and bounded read; no arbitrary proxy or user-controlled upstream URL.
- Existing identity verifier is required inside the route, not just middleware; a missing or invalid owner identity receives 401 without dispatching any source.
- Malformed, unknown source, oversized body, unauthorized use, malformed upstream data or failed upstream requests fail closed, with no raw transport errors leaking to Ask.
- This source gateway never calls the Spatial Evidence store or Reality admissions. GEV-LIVE.04–.14 must separately prove real authorized upstream reads, durable hashing/readback, non-fallback admissibility and owner-scoped Ask receipt. Do not upgrade mocked records or source-only CI into production evidence.

## Required follow-on steps

1. Finish GEV-LIVE.02–.03 Spatial Conformance on exact branch HEAD, confirm no affected application CI failures and review PR against merged dependency.
2. Obtain authorized production Vercel deployment identity (currently no verified preview for this branch) and owner-authenticated route response on exact deployed SHA.
3. GEV-LIVE.04: implement consented/approved provider configuration for CCTV, aircraft, AISStream, FIRMS. Never silently activate rights-restricted sources.
4. GEV-LIVE.05–.07: verify privileged Supabase OIDC and real source→immutable evidence→candidate→explicit admission readback. Confirm six append-only tables and normalized provenance.
5. GEV-LIVE.08–.14: connect the read path to canonical Ask and Spatial World without a second Reality system; run adversarial, restart and same-SHA acceptance.

**No external hosting purchase, Vercel promotion, DB schema write or live-data certification was authorized by this source PR.**
