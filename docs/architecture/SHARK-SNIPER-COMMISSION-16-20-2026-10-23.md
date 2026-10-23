# SHARK-SNIPER.COMMISSION.16–.20 — safe commissioning evidence
Date: 2026-10-23 (America/Los_Angeles).
Parent: #1501 → #1499 → #1497 → #1457; review #1455 and #1496 separately.
Branch: `build/shark-sniper-commission-16-20-20261023`.

## Design and truthful readiness
This sequence adds source-only protection, isolated research-only canonical RPC
cross-check, opt-in single-writer host wrapper, honest source-scope latency
statistics and restart tests. **A passing test is not a measured 600ms mint
discovery, profitable sniper, commissioned real-time worker, certified
onchain entry/exit or approved trading authority.**

### .16 Protected private iPhone preview
- Reuse existing owner-authenticated `/shark/sniper` page and
  `/api/internal/shark/sniper/public-canary` endpoint from #1499.
- The endpoint requires Supabase session with sub equal to the immutable,
  trusted `JHADINA_OWNER_USER_ID` and default-OFF
  `SHARK_SNIPER_PUBLIC_CANARY_ENABLED=true`. It has no wallet methods.
- Existing Jhadina Vercel project
  `crispy-waddle-jhadina-web` has Vercel Authentication/SSO protection
  `all_except_custom_domains`; do not alias a QA preview to an unprotected
  custom domain. Confirm exact deployed commit, build status, authenticated
  iPhone acceptance and access denial to another user before claiming ready.
- A green CI "Growth Vercel Prebuilt Preview" is a *build check*, not by
  itself a deployed protected Jhadina app.
- New `GET /api/internal/shark/sniper/verify-chain` is separately
  default-OFF via `SHARK_SNIPER_RPC_CANARY_ENABLED`; owner-only Supabase
  JWT sub, no service-role browser credential and no third-party redirect.
  The iPhone `/shark/sniper` page exposes manual signature/mint/slot
  research verification with explicit no-trade status. Its request timestamp
  is the MANUAL RPC check time, **not** the original Helius event receipt.
- Never disable user login or preview protection merely for testing.

### .17 Source identity and stage verification
- Existing authenticated Helius webhook remains canonical ingestion
  `POST /api/webhooks/helius/launches`. Its provisional 1-second
  provider timestamps do not prove 600ms onchain capture.
- New `sniper-chain-receipt.ts` uses *only when explicitly called* a
  fixed-host public Solana `getTransaction` RPC with `confirmed`
  commitment to independently cross-check an exact base58 signature,
  claimed slot, successful transaction meta and a parsed SPL token
  `initializeMint/initializeMint2` instruction for the claimed mint.
- Absent confirmation, inner-instruction ambiguity, provider outages,
  wrong mint/slot or failed transaction produce no chain proof. The RPC
  is never used to authorize trades, imply swap sellability, attach false
  market quotes or bypass SHARK's risk veto.
- `getTransaction` returns null if the signature is unavailable at the
  requested commitment: https://solana.com/docs/rpc/http/gettransaction
- The existing DexScreener profiles reader remains *public-price only*;
  its promotional coverage is not a complete birth feed.

### .18 Opt-in private local paper host
- New `sniper-commission-host.ts` reuses
  `runSniperReadOnlyLoop`, `runSniperLivePaperTick`,
  `createFileSniperPaperMonitorStore` and
  `recoverSniperPaperMonitorJournal` without duplicating Money Core.
- Requires explicit `approvedReadOnly=true`, a real owner-private
  pre-existing 0700 absolute directory, unique 0600 exclusive lease, and
  operator-supplied source work + bounded 1–60s pacing and 1–10000 cycles.
- It neither loads nor invents tokens from the journal. Caller must source
  candidate identities, old exit inventory and quoted evidence from the
  canonical systems. Stale work clock rejects. Unresolved exits remain
  represented by Money's EXIT sentinel.
- Graceful completion / exception frees lease. A SIGKILL leaves the
  `sniper-paper-owner.lock` lease in place and blocks restart for manual
  inspection; it must never be silently stolen.
- This is an executable host **library**, not a deployed daemon, 24/7 uptime,
  capital execution agent or multiservice distributed lock. The originally
  staged Railway Telegram worker remains inert and unrelated.

### .19 Honest source timing
- New `sniper-commission-latency.ts` summarizes actual ingress receipt
  objects' p50/p95/p99 for provider timestamp-to-receipt and local processing.
- These timings have source timestamps rounded to seconds; never infer
  0.6s source-to-execution, onchain slot delay, genuine quote-to-fill,
  landing, MEV success, realized returns or exit times from these objects.
- Empty receipts mean NO MEASURED SAMPLE, not "0ms" or "no launches."
  End-to-end latency certification requires an independently validated
  external event reference clock, full matched chain event set, submit /
  land and exit receipts, and missed-event denominator.
- True chain identity receipt is research-only; repeat independent checks
  and measure provider RPC time separately.

### .20 Recovery and release evidence
- Added tests for matching/failed/missing Solana confirmations, RPC outage,
  fixed-host calls, source-second latency caveat, host opt-in, single-writer
  orphaned lease, no invented exits, journal replay, provider offline,
  stale source snapshot, and explicit research/no-sign authority.
- SHARK CI includes them. Jhadina Launch Gate, Money R13B, UX and Spatial
  remain required exact-head checks before merging and any preview.
- A passing graceful stop/restart fixture is **not** a destructive
  SIGKILL/power-loss recovery test on a deployed persistent volume.

## External acceptance still blocked pending real evidence
1. Resolve exact protected preview Git source SHA + owner iPhone FaceID
   session / navigation and second-user denial; no user credentials in logs.
2. Confirm current Helius authorization and active delivery configuration
   without exposing headers or bearer tokens. No paid subscription or API
   modifications without a separate funding approval.
3. Collect 100+ prospective chain-rooted launches with original
   signature/slot/provider/webhook clocks, including misses and errors.
4. Attest two-sided indicative route and realistic fee/slippage/MEV estimates
   separately from public prices; do not fake executable/sell routes.
5. On separately authorized persistent owner host: verify real mount,
   launch/exit queue, loss of network, restart and orphaned lease recovery;
   compare journal hashes before/after.
6. The connected Jhadina Supabase project still needs the canonical sniper
   archive + Shadow learning schema separately reviewed, migrated, RLS-tested.
7. Future Coffer funding, Phantom signer, Telegram auth/listening or live
   trading would each require separate explicit permission. None is granted
   by this paper-only commissioning PR.

No source code is allowed to self-enable unattended trading or money movement.
