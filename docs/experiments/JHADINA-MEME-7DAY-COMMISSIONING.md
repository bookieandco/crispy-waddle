# SHARK seven-day memecoin commissioning handoff

Experiment: JHADINA-MEME-20261013-7D-001
Window: 2026-10-13T22:50Z to 2026-10-20T22:50Z
Mode: public read-only data, shadow abstention, offline paper simulation.
No real orders, keys, paid services, verified rug oracle or signing.

## Verified components and strict limits

1. DexScreener profiles/boosts poll + real pair/price/liquidity observations,
   not comprehensive first-mint discovery or second-level sniping.
2. GitHub cron, data-only branch and hash receipts: best effort; scheduling
   can be delayed/dropped. Hashes are auditable, NOT tamper-proof receipts.
3. Solana mainnet mint metadata lookup through official RPC then fixed free
   PublicNode fallback, max one mint per run. Mint/freeze authority and top
   token-account concentration do NOT verify LP control or wallet clustering.
   Provider errors remain UNVERIFIED; a crash alone is not a confirmed rug.
4. Prospective SHADOW_NO_TRADE evidence is sealed only against genuine
   current-cycle market observations, including existing watched mints, with
   decision-time prices/timestamps. Older observations are never backdated.
   Both original first-price and later Shadow decision 24–30h horizons reserve
   up to 12 additional read-only quote slots per cycle, including evicted mints;
   missing data or observed pair switches are unscored, never synthetic P&L.
5. Offline paper model requires independent safety coverage and point-in-time
   DEX route quote plus Money Core paper authority. Incomplete route or
   unsellable token = NO_FILL, never a fabricated profitable exit.
6. Public iPhone-readable digest stored on the experiment data branch.
7. Private owner Telegram daily digest code exists but is intentionally OFF
   unless GitHub Actions variable ENABLE_SHARK_MEME_DIGEST=true is explicitly
   configured; existing owner-only secrets must also work.

## Gates remaining before declaring complete autonomous paper sniper

- Commission legitimate fast on-chain mint/Pump lifecycle stream and proven
  health on an appropriate always-on host; GitHub cron cannot react in seconds.
- Verify liquidity ownership/withdrawals, sellability, mint extensions,
  independent owners and funders, developers, migration semantics and actor history.
- Wire canonical SHARK actor-aware assessment to Money Core paper risk and durable
  state with scheduler identity and independent authorization.
- Obtain real route-executable pre/post migration quotes including slippage,
  partial fills, priority fees, failed quote and exit conditions.
- Build and verify durable attribution, learning, false-alarm labels and missed
  opportunity analysis using genuine available-at timestamps.
- Run several unattended scheduled cycles and restoration/failure tests; check
  final Oct 20 cutoff and prove self-disable or perform owner stop.
- Only after seven elapsed days, score true prospective predictions and warnings.
  Never claim missing observations are wins or confirmed non-rugs.

Success of offline CI or sampled market data does not certify production
memecoin trading. Real money remains categorically outside this experiment.

Test:
python -m unittest discover -s ops/meme -p 'test_*.py' -v


## October 14, 2026 audited recovery receipts

Do not confuse experiment measurements with live trading certification.

- PR #1259, merged at 3409034fce2ed9f958be12ae812f65b66db1a639:
  reserved 12 24–30h follow-up quotes per cycle, preserving previously sealed
  decisions and token first-pair identity after active-watchlist eviction.
  Offline CI: all 50 Python safety and cohort tests passed. First live run
  38659044475 succeeded; 12 evicted follow-up observations recovered, 11
  24h naive marks, 2 later Shadow grades. No backfilled fake outcomes.
- PR #1261, merged at 82a48ce9e57354d44e3ca2829ef2420aabd4c279:
  published deduplicated severe observed market warnings in phone report
  with timestamps, public token mints, risk flags and hash-linked evidence.
  Offline CI: 53 tests passed. First live workflow 38659305694 succeeded.
- Data-only branch experiments/meme-20261013-seven-day-001
  at cycle 60, 2026-10-15T00:19:09Z: 543 distinct public-profile/boost
  mints, 870 sampled market-pair observations, 24 evicted follow-up quotes,
  23 first-price 24h marks (26.09% naive up-rate, N=23), 10 observed
  Shadow grades, 159 prospective NO_TRADE decisions and 159 fail-closed
  Money-admission records. Warning observations: 47 across 45 distinct
  token mint addresses, all UNVERIFIED market lookouts, zero confirmed
  rug labels. Partial mint RPC: 54 succeeded, 5 unavailable/unverified.
  Zero paper fills, zero real trades, zero wallet signing, no charges.
  These numbers are early and will change with genuine later runs.
- Repository dashboard path is
  training/meme/experiments/2026-10-13-seven-day-001/report.md
  on the data branch, NOT main. Do not rewrite baseline or history to
  improve the appearance of scores.

## Still blocked — must not silently promote

1. GitHub-hosted half-hour schedule is NOT fast launch sniping.
2. Liquidity-control and sellability verification, Token-2022 extension
   handling, independent holder/operator graph and creator history are
   still incomplete. A risk lookout is not a confirmed scam determination.
3. Canonical runMemeAssessmentCycle cannot be commissioned against the
   current Swlc Supabase production schema: the October 3 migration pair
   for assessment and Money runtime ingress was not present in the
   October 13 read-only audit, and launch/actor histories were empty.
   Recovery/preflight is tracked in GitHub issue #1257; do not deploy
   partial migrations over existing production without dependency/RLS
   audit and backup/restore verification.
4. Jupiter GET diagnostic is INDICATIVE route evidence, not an
   executable quote with an actual sell-fill guarantee. Money paper
   admission is correctly NO_TRADE for unknown security and authority.
5. GitHub scheduled run gaps, missing outcomes and pool switches remain
   censored/unscored; 7-day experiment cannot certify final accuracy
   until after October 20, 2026 cutoff.

Never activate real wallet keys, real transactions, paid subscriptions
or supposedly independent risk approval as part of this study.
