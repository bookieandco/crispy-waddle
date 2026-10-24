# SHARK-QUOTE-HOST.V2.COMMISSION.05–.08 (2026-10-24)

**Scope:** Source-only commissioning and acceptance, stacked after #1517 → #1516. No deployment, new Railway service, environment variable mutation, paid Jupiter API key, authenticated Telegram listener, wallet signing, or real trades.

## .05 — current exact-head code check and provider contract
- Parent draft PR #1517 head `47a3b19498b89785383c0c7368de91805b5d7c59` had all three required GitHub workflows green on the exact head (SHARK Quote Host Research, Spatial Conformance, Jhadina Launch Gate) before this child was created.
- Jupiter V2 official Order & Execute documentation confirms `GET https://api.jup.ag/swap/v2/order`, without `taker` → quote with `transaction:null`. No request to `/execute`, `/build`, signing or landing. See https://developers.jup.ag/docs/swap/order-and-execute.
- Public keyless platform allowance is 0.5 RPS as of October 2026 (https://developers.jup.ag/changelog/developer-platform); the existing code conservatively waits at least 2.5 s between starts. That is a research rate limit, *not* a viable subsecond order execution path.
- Child exact-head check status must be retrieved independently; prior parent green CI cannot certify later commits.

## .06 — explicit scope and cost gating, no deployment
The default-held `worker_once.py` performs no network call. A one-shot four-pair smoke requires, *simultaneously*:
- `SHARK_QUOTE_WORKER_MODE=smoke`
- `SHARK_QUOTE_WORKER_READ_ONLY_APPROVED=YES`
- `SHARK_QUOTE_WORKER_METERED_BUDGET_APPROVED=YES`
- `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_SERVICE_ID` each UUID-equal to separately configured `SHARK_QUOTE_EXPECTED_PROJECT_ID`, `SHARK_QUOTE_EXPECTED_ENVIRONMENT_ID`, `SHARK_QUOTE_EXPECTED_SERVICE_ID`
- `SHARK_QUOTE_WORKER_SAMPLES` between 1 and 4 inclusive
- no `CI`/GitHub Actions/Vercel execution context; no `JUPITER_API_KEY` (initial keyless smoke only); not a Telegram-named service.

**These environment assertions are configuration checks, not an independently authenticated host or payment authorization.** An administrator could set both actual and expected values locally. Release acceptance must compare actual deployed Railway resource IDs, owner authorization and workspace budget in Railway itself. The source-side YES flags are *not* approval by the owner; no flags have been staged on Railway.

Current observed existing infrastructure before this child: Railway `Jhadina Telegram Cloud` staging project ID `35f38a85-097c-4e77-ad17-1b84554f8d44`, staging environment `83b41578-7cc6-46e5-9198-6293c6cfd868`, deployed service `jhadina-telegram-owner-listener`. Held listener's private 512 MB volume and configuration must not be repurposed. The new SHARK quote worker service **does not yet exist**.

If the owner later approves a new service and shared metered usage:
1. Check Railway cost cap/usage impact first. A shared workspace hard limit can stop other services; do not modify it without separate permission.
2. Create a **new dedicated read-only** service in an explicitly named environment, from reviewed exact branch SHA; its Dockerfile lives at `scripts/shark-sniper/Dockerfile.quote-host` with repository root build context. First deploy with **no smoke variables** (default HOLD).
3. Verify terminal SUCCESS, held container log marker, single-run behavior, no extra volumes/domains, no secrets and exact project/environment/service ID with the Railway platform.
4. Obtain separate owner authorization to set exact one-shot smoke and budget flags on that service only, read back the config (not secret values), run 1–4 samples, and return to HOLD after completion. Never activate `jhadina-telegram-owner-listener`.

## .07 — offline read-only evidence checker
`validate_smoke.py` structurally checks the worker's exact startup marker plus bounded JSONL samples and summary: unique 1-based sequence, UTC-offset timestamps, duration ranges, complete forward/reverse attempt denominators, valid provider enum, reason categories, actual error counts, policy/money vetoes and incomplete-sample rejection. It returns `runtimeAuthenticated:false`, `independentProviderAttested:false`, `deadlineCertified:false`, `canTrade:false` regardless of result. Even synthetic fixtures can pass structural checks; actual provider readback and worker authenticity must be corroborated separately. `NO_COMPLETE_PAIR_OBSERVED` is not a successful quote smoke.

For a *separately approved actual* one-shot smoke, capture stdout privately (startup marker + 4 JSONL records + summary), then run:
```bash
cd scripts/shark-sniper
python3 validate_smoke.py /path/to/private/quote-smoke.jsonl
```
Never put API keys, owner wallet identity or private data into public CI artifacts. The audit has no network call and never promotes latency limits.

## .08 — tests and later SLA acceptance
Offline workflow runs `test_quote_probe.py`, `test_worker_once.py`, `test_validate_smoke.py`, rejects attempting smoke on CI, and checks the default hold marker. Require exact-head SHARK Quote Host Research, Jhadina Launch Gate and Spatial Conformance to finish and pass. Do not infer deployment from CI.

The 4-pair smoke is **only** a network sanity test, not enough for a latency SLA. Before numeric stage deadlines, separately approve ≥100 prospective two-direction reads + all failures and a 24–30-hour canonical SHARK launch cohort, then calculate per-stage p50/p95/p99, timeout/failure rates, source publication/receipt delay, quote freshness, sample bias, cost/spread and independent reverse sellability. Thresholds must honor canonical Money TTL/risk vetoes, never widen stale evidence TTL, and never claim execution→fill→exit timing or profit from read-only quotes.

**Release control:** `canFund=false`, `canSign=false`, `canTrade=false`, `canBroadcast=false` until independently reviewed atomic signer, custody, RPC, original Money permits, durable reconciliation, owner iPhone acceptance and separate owner-approved first BUY and SELL canary. This target authorizes none of those steps.
