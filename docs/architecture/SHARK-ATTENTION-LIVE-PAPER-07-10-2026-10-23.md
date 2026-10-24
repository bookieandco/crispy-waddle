# SHARK-ATTENTION.LIVE-PAPER.07–.10 — dependent acceptance handoff

Date: 2026-10-23 PDT. Status: **source-only, draft, unmerged, not deployed**.
Base: PR #1511 (SHARK-ATTENTION.01–.06), not main.
Branch: feat/shark-attention-live-paper-07-10-20261023.

## What was coded

### .07 Fixed public feed adapter
- `attention-public-dex.ts` performs an optional, explicitly caller-invoked
  HTTP GET to official `https://api.dexscreener.com/token-pairs/v1/solana/{mint}`.
  This endpoint is listed in DEX Screener's official reference with a 300/min
  provider ceiling. One call per explicit invocation, no recursive scanning,
  no paid credentials, no dynamic destination or redirects.
- Reuses `normalizeDexScreenerPair` from the existing SHARK core instead of
  introducing a second chain market normalizer. Only same-chain, requested
  base mint with valid pair address, positive price and valid liquidity is
  considered. Highest reported liquidity wins deterministically.
- Labels `sourceAuthenticated:false`: public HTTP response is not verified
  on-chain state, audit-quality venue liquidity or executable fill evidence.
- Transport has a five-second abort and a 256 KiB text size check; an
  additional streaming-size cap at the trusted network boundary remains
  a requirement for unattended commissioning. App must enforce provider-wide
  rate budget below published limit and honor terms before enabling polling.
- No news, X, Reddit, stream or Telegram collector is attached; source
  licensing/approval for those requires separate review.

### .08 Bounded additive SHARK public paper tick
- `attention-live-paper-cycle.ts` compares two caller-supplied,
  same-pool time-ordered public observations, at most 15 minutes apart.
  Calls existing `assessPublicAttention`; forwards only research alerts.
- Freshness/pool identity failure => `STALE_OR_INCOMPARABLE_NO_SIGNAL`,
  never imaginary trend. No trading actions, signer, wallet or storage.
- This does **not** create a second market host, scheduler, SQLite ledger,
  scanner or execution authority. Existing `ops/meme/shark_live_intelligence.py`
  remains owner of durable public paper studies and multi-cycle timing.
  The TypeScript adapter is not yet invoked by that worker in production.

### .09 Owner-only iPhone research inbox
- New GET-only `/api/shark/attention` checks an authenticated Supabase
  user against Jhadina's provider-verified personal-owner policy. Uses
  owner-scoped reads, no-store response, recent seven-day bounded rows.
- New `/shark/attention` page serves a mobile-friendly view with
  explicit research-only / no-live-feed disclosures.
- Migration `20261023000200_shark_attention_owner_alerts.sql` defines
  owner-only RLS **read-model projection**. Client writes are denied.
  There is no creator, projector, push-notification sender, background
  worker, Telegram delivery or production database change in this PR.
  A missing migration returns a 503 unavailable rather than made-up alerts.
- The UI is only a read-only inbox interface once an independently
  approved and correctly scoped projector populates it; it does not
  certify iPhone push delivery or live phone acceptance.

### .10 Prospective paired comparison
- `attention-prospective-paper.ts` grades two PRE-DECLARED
  `PAPER_ENTER` / `NO_TRADE` policies on exactly the same candidate,
  mint, pair and 24–30-hour eligible future price observation.
  Missing/out-of-window/different-pair marks are censored.
- Conservatively subtracts explicit **assumed** round-trip costs.
  Reuses `compareAttentionPaperPairs`; never substitutes price-only
  marks for executable fills, or asserts performance/alpha/live authority.
- A prospective evidence archive and actual commissioned provider
  observations remain mandatory to run an honest experiment.

## Verification plan

```bash
pnpm --filter @jhadina/shark-intelligence-core type-check
pnpm --filter @jhadina/shark-intelligence-core test
pnpm --filter @jhadina/jhadina-web type-check
```

Exact-head SHARK, Spatial and Launch Gate checks must finish and be
reviewed before merge. Unit mocks are not genuine network/provider proof.

## Preserved authority boundary and remaining blockers

- **No Telegram API content in AI/ML**. See official Telegram API §1.5.
  The cloud listener continues to be independently held/disabled.
- **No financial execution**: no wallet signing, order, broadcast,
  transfers, spending, paid model/provider, or SHARK/Money live promotion.
  Phantom owner verification, if present, is observation authority only.
- **No new deployed cron / server / production DB**: persistent 24–30h
  real-world comparison requires commissioned host, storage, and
  prospective signed/timestamped source receipts. Historical screenshots
  and invented replay values cannot fill gaps.
- **No real iPhone notification certified**: route/page and migration
  are code only. Need explicit migration approval, project-scoped owner
  test, allowed read-model projection, permitted alerts/delivery,
  and private device readback.
- **No externally validated profits**: all cost and slippage numbers in
  the paired comparison are hypothetical scenario assumptions.

## Next smallest safe acceptance sequence

1. Review #1511 and this stacked PR, resolve exact-head tests, no bulk merge.
2. Certify real public Dex transport provenance, budgeting and a bounded
   owner-controlled sampler; stay on trusted public source only.
3. Observe continuous durable local SHARK worker over 24–30h with complete
   prospective clock and censoring, then compare with the attention branch.
4. Review SQL migration/authorization and deploy separately to staging.
5. Verify private owner iPhone GET/page, alerts/delivery without public data,
   and recovery behavior; only later consider push transport.
6. Review any Money/Coffer live order permission as a completely separate
   authorization; nothing in these targets creates it.
