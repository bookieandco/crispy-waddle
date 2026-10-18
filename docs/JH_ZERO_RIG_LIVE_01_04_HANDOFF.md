# JH-ZERO-RIG.LIVE.01 → .04 — read-only commissionable research

**Stacked:** PR #1375 → PR #1377 → this PR. Do not merge in the wrong order. Current branches may be diverged from main and must be reconciled before release.

## .LIVE.01 — fixed-host Superteam API transport
Official specification: https://superteam.fun/earn/agents , https://superteam.fun/skill.md . Read-only GET /api/agents/listings/live?take=20 with Bearer key, deadline lower bound. Strict exact-host/path allowlist, take 1–20 in web route, 8-second fetch timeout, no redirects, response size max 256 KiB, JSON-only. Injected fetch for offline certification, scrubbed upstream errors. Do not infer schema fields from documentation not provided; unknown/ambiguous rows remain unverified/rejected. Provider-API success requires a separately approved real canary; no API key available in this PR.

## .LIVE.02 — human/operator eligibility
Deterministic assessment requires: unexpired listing, documented agent access, country eligibility, terms acknowledgement, official listing detail reference, original-work plan evidence, questions review, and verified claimant profile; project submissions also require operator Telegram URL. The state `eligible_for_research` is NOT payout eligibility or authorization to submit. No account registration or claim is supported.

## .LIVE.03 — owner-scoped read-only route and UI
Node route `GET /api/opportunities/zero-rig/superteam?mode=readiness` reads owner status without provider calls; `?mode=list&take=20` performs a single fixed-host provider GET only after owner-auth, exact owner ID, explicit enable flag, and server-side API key. Disabled by default. Feature flag: `ZERO_RIG_SUPERTEAM_READS_ENABLED=true`; owner claim ID: `ZERO_RIG_OWNER_USER_ID`; server-only key: `ZERO_RIG_SUPERTEAM_API_KEY`. Never use NEXT_PUBLIC for secrets. Responses do not include tokens. UI requires explicit press; never auto-polls.

**Rate limiting:** this is one-request-per-click and upstream 429 handling, NOT a durable distributed per-owner rate limiter. Do not enable for broad end-user traffic without an approved cross-instance limit/circuit-breaker. No scheduler exists.

## .LIVE.04 — acceptance and commissioning gate
Tests use injected fake HTTP responses; cover auth, feature flag, GET-only transport, take, timeout config, oversized bodies, invalid content type, malformed JSON, credential errors, mixed-agent filtering, expiry, geo, missing human claimant, and fail-closed returns. Exact-head CI remains authoritative.

**External operator evidence still required:** owner-auth on iPhone, key provisioned in a secret store, official live listing schema captured without sensitive fields, API 200/401/429 behavior, detail contract and geographical rules, human claimant account confirmation, actual observed bounty/reward evidence, private data security, and real Money Core payout reconciliation. No secret is requested in chat; register and verify through existing protected operations.

## Status/authority
Source target complete subject to CI. No runtime/production commissioning claimed. No agent created, no money moved, no mining, no submissions, no external bounty work, no payouts and no off-platform operations.
