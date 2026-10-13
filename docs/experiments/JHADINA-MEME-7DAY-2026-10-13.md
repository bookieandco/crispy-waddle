# SHARK / Shadow seven-day memecoin and rug-lookout study

**Status:** implementation is a bounded, read-only public-market pilot, not a commissioned sniper or verified rug oracle.

Window: **2026-10-13 22:50 UTC – 2026-10-20 22:50 UTC** (October 13–20, Los Angeles time). Experiment `JHADINA-MEME-20261013-7D-001`.

## The measurement

- A public DexScreener **latest profile + boost sampler**, *not* the complete set of freshly minted Solana tokens, watches at most 90 token addresses and rotates up to 30 per cycle. The 30-minute GitHub Actions schedule is best effort, and does **not** meet millisecond/second-level sniping latency. Delays and missed runs are reported by timestamps, not filled synthetically.
- Only fixed read-only endpoints are called: `/token-profiles/latest/v1`, `/token-boosts/latest/v1`, and `/tokens/v1/solana/{up to 30 addresses}`; there are no secrets, private wallets, trade APIs, paid subscriptions, or orders.
- For a given token, the highest-liquidity *base-token* Solana pair is sampled. Pair identity, quote mint, observed/available-at timestamps, price and USD liquidity are recorded as provider evidence. A pool switch **censors** comparability; it is not spliced into a fake return curve. Pair creation time is never treated as quote collection time.
- Flags are preliminary: `LOW_LIQUIDITY`, `SUSPECTED_LIQUIDITY_DRAIN_NOT_PROVEN_RUG` (>=70% observed reduction), `PRICE_COLLAPSE_NOT_PROVEN_RUG` (>=70% observed loss) and `PAIR_SWITCH_CANNOT_COMPARE`. None proves malice or a rug. No holder, freeze/mint, developer clustering, LP ownership, or on-chain liquidity-removal proof is supplied by these endpoints, so safety is **UNVERIFIED** and **canTrade=false** for every case.
- A fixed naive baseline predicts positive price movement over 24 hours from each case's **first observed** market quote. A mark is recorded only from an observation 24–30 hours later on the same original pair, and is labeled **price-only/non-executable**, with no claim of actual fills or tradable returns. Missing observations are unscored, not losses or wins.
- State is stored on `experiments/meme-20261013-seven-day-001` separate from default-branch code. Each observation is hash-linked to its predecessor and later Git commits provide additional chronology. This is auditable evidence, **not independently immutable or tamper-proof data**. The branch is public: **never ingest private Telegram messages, credentials or identifying wallet-owner data**.
- The runtime fails closed on unavailable feeds, corrupt state, unsupported payloads, data-cap exhaustion or out-of-window observations. It will record COMPLETED and attempt to disable its own GitHub workflow at cutoff; a permissions denial of workflow disable requires owner action.

## Existing SHARK reuse and limitations

This experiment extends, rather than replaces, `packages/shark-intelligence-core/src/meme-trader/*` and its existing migration radar, sniper candidates, wallet graph, actor outcomes, rug self-protection, Moon/Shadow learning and Money paper controls. It is **not yet wired** through canonical `MemeTradeAssessment` -> SHARK/Money governed envelope or the Supabase learning repositories. The early pilot cannot approve even virtual risk-bearing entries without those independent checks; it tracks non-executable market hypotheses instead. The GitHub workflow is a slow, low-cost research sampler rather than a low-latency on-chain listener.

## Daily reviews (not self-promotions)

1. Provider uptime, real polling timestamps, number of observed mints/pairs, unseen launched tokens and sampling bias.
2. Suspicious liquidity/price alerts and independent on-chain verification outcome. **Unknown is not safe and a crash is not a confirmed rug**.
3. Non-executable 24h baseline direction accuracy on uncensored cases; mark availability, coverage and survivorship/missingness.
4. Missed/late alerts, adverse moves before next poll, pair discontinuities and potential provider outages.
5. After seven days, compare no-trade guard to naive price-only baseline; propose only *paper* changes with evidence. No strategy can grant itself signing or capital authority.

## Verification

```sh
python -m unittest discover -s ops/meme -p 'test_experiment_7day.py' -v
python ops/meme/experiment_7day.py --mode audit --state training/meme/experiments/2026-10-13-seven-day-001/state.json
```

Data and audit history will only accumulate after the workflow is merged onto `main`, push/schedule triggers execute, and the GitHub token is allowed to update the data branch. A file existing in GitHub does not itself demonstrate that a live sample has run.
