# SHARK-QUOTE-HOST.V2.01–.04 — draft owner-host runbook (2026-10-24)

**STATUS:** Source-only stacked child of GitHub PR #1516. No Railway SHARK service created or deployed, no Jupiter API request run on a real worker, no paid provider activated, no Money signing or trades. The existing Railway *Jhadina Telegram Cloud* staging service belongs to the independently held Telegram listener and must not be repurposed.

## .01: V2 quote-only contract
- Fixed exact HTTPS **GET** `https://api.jup.ag/swap/v2/order`, with only inputMint, outputMint and amount. **No taker, receiver, payer, sign/execute, build, slippage override or arbitrary endpoint.**
- Require `transaction: null` and no taker in V2 responses. Reject string/empty/absent transaction, unexpected taker, quote errors, unknown router, malformed mode/amounts and identity mismatch.
- V2 provenance: `requestId` SHA-256 **digest**, router (`metis`, `jupiterz`, `dflow`, `okx`), mode and bounded fee bps. This is *provider evidence*, not an onchain attestation.
- V2 supports routePlan differences for RFQ. Do not invent `contextSlot` (V1 response field). The absence of chain context is explicit in output.
- Defaults SOL/USDC, 10,000,000 atomic SOL (not a memecoin launch); hypothetical reverse request uses observed expected output **as a number**, no actual coin is held.
- Optional `JUPITER_API_KEY` is sourced only from the worker environment; no key is required for limited keyless traffic, keys are never logged or committed. Free API key, not a paid subscription, is a separately accepted host configuration.

## .02: bounded latency evidence
- Every forward/reverse attempt is timed with a monotonic local clock, including partial failures. The denominator separately counts successful hypothetical pairs, missing reverse quotes, HTTP authorization, 429 and unexpected responses.
- Emit p50/p95/p99 for **observed attempts**, plus completed-pair HTTP timing; do not confuse keyless rate-limit waiting with order execution performance.
- Max 128 KiB response, no redirects, bounded timeout 10 seconds, at least 2.5 seconds between request starts. Provider's current **0.5 requests/second keyless limit** is why smoke pacing is intentionally slower than a trading fastlane.
- Returns no signing, broadcasting, wallet, Money, Purse or profit authority. No quote alone demonstrates fill, slip, MEV protection, launch time or settled exit.
- Quote-only V2 does **not** guarantee its response includes chain slot, quote freshness or full route details. A separate canonical SHARK onchain/market source is required.

## .03: isolated Railway worker packaging
- `scripts/shark-sniper/Dockerfile.quote-host` builds from the repository root, copies only the read-only Python probe and `worker_once.py`, and runs as a non-root user.
- **Default is HOLD**: no network call, no scheduler, no volume read, no model/Telegram data, no environment inspection for wallet keys, no persistent process.
- A separately approved, one-time smoke invocation requires `SHARK_QUOTE_WORKER_MODE=smoke` and `SHARK_QUOTE_WORKER_READ_ONLY_APPROVED=YES`. Max 4 pairs per process; `--samples` cannot increase it via worker environment. The worker exits after completion.
- For a later specifically approved Railway deployment: provision a NEW SHARK-only service in staging, Dockerfile path `scripts/shark-sniper/Dockerfile.quote-host`, build context repo root. **Do not change the Telegram owner-listener service or its 512 MB private volume.** Review workspace's shared metered limit, project, image SHA and owner authorization before staging/applying any infrastructure. No secret key is necessary for keyless smoke.
- No infrastructure is being staged, accepted, deployed, or configured by this PR. Defaults hold even if someone deploys the image without approved activation variables.

## .04: tests, acceptance and blockers
Offline:
```bash
cd scripts/shark-sniper
python3 -m unittest -v test_quote_probe.py test_worker_once.py
python3 worker_once.py   # prints HELD and makes zero requests
```
The GitHub workflow `.github/workflows/shark-quote-host-offline.yml` runs tests and verifies the default-held marker; exact-head result must be inspected before calling CI green.

Manual smoke **ONLY on an explicitly authorized isolated worker**, not on GitHub Actions or the Telegram service:
```bash
SHARK_QUOTE_WORKER_MODE=smoke SHARK_QUOTE_WORKER_READ_ONLY_APPROVED=YES python3 worker_once.py
```
Smoke output is terminal JSONL research receipts. Keep operator notes private; never paste provider keys, wallet private data or raw owner identifiers into a PR. Distinguish actual HTTP response timings from expired quotes, denied requests and rate pacing.

Do not assign entry/exit SLA, advertise subsecond event-to-exit, sign or fund a wallet until: valid real host smoke, all failures accounted for, at least 100 successful pairs and their failures, separately approved 24–30h prospective canonical SHARK launch cohort, authenticated onchain/source identity, delayed/failed exit observation, fee/spread/MEV estimates, restart/fault tests, isolated signer+Money atomic reservation fixes, and separate owner canary BUY/SELL funding approvals.

Provider references: https://developers.jup.ag/docs/swap/order-and-execute ; https://developers.jup.ag/docs/api-reference/swap/order ; https://developers.jup.ag/docs/portal/setup.
