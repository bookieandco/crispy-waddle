# SHARK-ALPHA.FABRIC.09–.12 — Approved social research, causal timing, Alpha Board

Date: 2026-10-17 PDT. **Source-only.** Stacks on draft PR #1382, which stacks on draft #1376; preserve earlier changes. No production rollout, automatic trading, token purchasing, fee spending, social-account access, third-party authorization, Supabase migration, secret disclosure or Telegram message training.

## .09: Approved social source adapters
- `apps/jhadina-web/src/lib/shark/social-alpha-sources.ts` is the **sole entrypoint of this stage** for bounded approved X/Reddit/Bluesky normalized posts into the already-governed `socialObservationToSharkSignal` path.
- Only `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts` is fetched directly, public GET with bounded query/limit/body, latest sorting, 8-second timeout; this endpoint can itself decline unauthenticated requests. No Jetstream or unsolicited broad firehose is commissioned.
- Existing approved X and Reddit tools supply **normalized payloads** to `normalizeApprovedXPosts` / `normalizeApprovedRedditPosts` after a separate permission check. This PR does not create OAuth credentials or make those provider reads. Reddit Ads `adsread` is NOT permission to read organic Reddit communities.
- `admitApprovedSocialAlpha` requires per-source terms approval AND owner opt-in, makes clock-safe receipt timestamps mandatory, rejects invalid/mismatched URLs or duplicated IDs, limits to 30 posts/batch and 12KB of per-post text during parsing. Only evidence hashes, candidate mentions, identities and provenance survive the conversion; no browser view of raw social content is added.
- `external-signal-ingest.ts` / canonical Social Core bridge gain `BLUESKY` EVIDENCE_ONLY platform, never trade/copy authority.

Official public-source references:
- https://docs.bsky.app/docs/api/app-bsky-feed-search-posts
- https://docs.bsky.app/docs/advanced-guides/api-directory
- https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data
- https://docs.x.com/x-api/posts/search/introduction

## .10: Coverage honesty
- `packages/shark-intelligence-core/src/meme-trader/alpha-social-evaluation.ts` defines source health receipts with access evidence, attempted and admitted counts, bad-post counts, and a last observed status.
- Every source health result retains `UNKNOWN_NOT_ALL_PLATFORM_POSTS`; failed/not-connected is **not** interpreted as zero post volume, zero mentions or zero opportunity.
- No AI model training, performance-reputation weighting or imported historical success attribution is enabled by the health receipt.

## .11: Exact-chain-bound available-time analysis
- Compare social candidates ONLY to an explicit Pump `CreateEvent` mint identity. A base58-like string from a social post is a candidate, never proof of an actual Solana mint.
- Preserve *publication*, *collector receipt*, *decision availability* and *chain event* clocks separately. Old forwarded posts and reconstructed provider results never count as early *SHARK* observations.
- Use `assessExternalSignalIndependence` to collapse shared upstream originals, reused content fingerprints and same-platform/source-family observations; do not mistake crossposts for independent alpha.
- `firstAvailabilityLeadMs` measures *when SHARK could have seen a signal vs when SHARK had a Pump CreateEvent receipt*. This is neither causal influence, predictive accuracy, market entry timing, executable profit, safe token status, migration completion, sellability nor proof that a source saw it pre-launch.
- Results include explicit caveats and `retrospectiveOnly`, `canAuthorizeTrade:false` and `canAutoCopy:false` fields.

## .12: iPhone-first Alpha Board
- `apps/jhadina-web/src/app/shark/alpha/page.tsx` retains existing prospective public-market study and adds a separate `SHARK_ALPHA_BOARD_V1` local JSON upload.
- The view presents source connection health, raw vs deduplicated mention counts, chronological social/on-chain evidence, censored comparison notices and **zero** verified execution claims. No new app route, database, owner identity or provider credentials.
- `alpha-board-view.ts` builds limited aggregate-only snapshots and strictly validates imported files; raw post text, social authors, Telegram identities and credentials are intentionally not exported. At most 20 sources, 100 token comparisons, and 200KB import; display is only in this browser session.
- The page does not initiate a background collection process, tell users that feeds are connected, or send an owner notification.

## Verification and production release gates
```bash
pnpm --filter @jhadina/shark-intelligence-core type-check
pnpm --filter @jhadina/shark-intelligence-core test
pnpm --filter @jhadina/jhadina-web exec tsc --noEmit -p tsconfig.shark.json
pnpm --filter @jhadina/jhadina-web exec vitest run src/lib/shark/social-alpha-sources.test.ts src/lib/shark/alpha-board-view.test.ts src/lib/shark/social-signal-bridge.test.ts
```
1. Both parents #1376/#1382 must remain consistent with current main. Do not merge this stacked child ahead of parents.
2. Exact-head SHARK CI, full web UX type-check/build and Spatial checks. No claim of live readiness from source-only tests.
3. Real approved source access, provider permissions and response-cap/cost evidence; X/Reddit NOT_CONNECTED until separately authorized, no account data use without consent.
4. Operator-approved authenticated running host, channel/source receipts, verified off-host backup, latency/gap measures and read-only canary.
5. Supabase Swlc recovery #1110/#1257 is distinct, outstanding and may not be bypassed with unmanaged durable writes.
6. No SHARK money/custody/transaction signer privileges; real-money execution remains disabled.

## Next bounded sequence
`SHARK-ALPHA.FABRIC.13–.16`: offline adapter commissioning gates, truthful launch-wide discovery cohort and missing-winner measurements, prospective baselines with costs/slippage/SELL proof limitations, owner authorization / production canary. Do not misrepresent social attention as safe executable alpha.
