# SHARK-FILTER.RESEARCH.01–.04 — video-screen integration (2026-10-21)

**State:** Source-derived, research-only code on a review branch. No live listeners, Money Core calls, order routing, wallet keys, Jhadina Purse access, paid services, or release authority.

## Evidence and purpose

Two user-supplied trader-video transcripts describe different but complementary ideas:

- **Source 1 / terminal Pulse:** progressively narrower screens for newly launched, final-stretch, and migrated pairs, based on reported fees, recent volume, holders, market cap and a social tick. The speaker estimates very high rug filtering, but gives no labeled dataset or out-of-sample accuracy evidence. The claim is not accepted as measured sensitivity or precision.
- **Source 2 / GMGN:** favor young, actively trending Solana coins (age, cap, fees), then consider liquidity/volume expansion, attention decay, chart structure, reward-versus-risk, and frequent rotation. Avoid treating 5-minute/15-minute RSI, support, narratives or headline P&L as proven entry signals.

The new module in `packages/shark-intelligence-core/src/meme-trader/stage-aware-discovery-screen.ts` stores source claims as deterministic **discovery** presets, not anti-rug rules. It is added to the existing `meme-trader` public package rather than opening a second SHARK engine.

## Imported Solana research presets

| Preset ID | Stage | Boundaries from source |
| --- | --- | --- |
| `VIDEO1_NEW_PAIR_SOL_V1` | New pair | Volume >= $1,000; terminal global fees >= 0.2 SOL; at least one social tick |
| `VIDEO1_FINAL_STRETCH_SOL_V1` | Final stretch | Age <= 167 minutes; holders >= 100; cap >= $3,000; terminal global fees >= 4 SOL; social tick |
| `VIDEO1_FINAL_STRETCH_FAST_SOL_V1` | Final stretch fast variant | Same criteria, except age <= 20 minutes |
| `VIDEO1_MIGRATED_SOL_V1` | Migrated | Cap >= $15,000; terminal global fees >= 5 SOL; social tick |
| `VIDEO2_TRENDING_SOL_V1` | Solana trending | Age <= 2 days; cap >= $100,000; terminal *total* fees >= 15 SOL |

No restricted launchpad allowlist is enabled. Pump and other named launchpads must be identified from trusted protocol metadata; marketing claims about currently popular protocols expire rapidly. The source's alternative ETH/"Robin Hood" discussion is **not** translated into a Solana fee rule, since venue/chain and metric semantics must first be independently resolved.

**Terminal global fees** and **terminal total fees** are different named measurements. Neither proves distinct real buyers, organic trading or that a token is sellable. Video-provided SOL numbers are not generalized across venues, networks, time periods or regimes. The model requires the correct fee kind, SOL unit, venue identity, metric timestamp and evidence ID. Unavailable or different metric -> `REVIEW`, never zero-filled. A low observation -> `SKIP`, never a proven rug classification.

### Source data vs production proof

The video transcript's '99%' claim, P&L screenshots, fee-based anti-rug assertions, and implied post-filter profitability are **UNVERIFIED_SOURCE_CLAIMS**. There is no independently labeled confusion matrix, point-in-time fee feed, or executable P&L demonstration for these settings. Social tick presence is only a coarse discovery signal and is not identity verification.

## Deterministic outputs and boundaries

- `MATCH`: satisfies the named screen **only**; no conclusion about safety or return.
- `REVIEW`: missing required input, including correct fee kind/unit and provenance.
- `SKIP`: one or more measured thresholds fail.
- `BLOCKED`: upstream independent SHARK defensive reasons exist; override all source rules.
- Every output returns its source version, passing/missing/failed fields and evidence IDs, `DISCOVERY_RESEARCH_ONLY`, `canLabelRug: false`, `canAuthorizeTrade: false`.
- Require event time <= available time <= any explicit replay knowledge cutoff; do not repair missing historical fields with later data.

This screen does **not** compute rug taxonomy, organic volume, sellability, probability of a run, priority fees, slippage, MEV edge or trade entries. Those belong to existing canonical modules or separately authorized future work. Keep `synthetic-volume-diagnostics.ts`, `migration-radar.ts`, `rug-self-protection.ts`, `actor-aware-assessment.ts` and Money Core authoritative for their own domains.

## Fast-path wiring plan (not yet implemented here)

```
independently commissioned real mint / protocol / pool event
  -> event decode + chain/venue normalization + timestamp/provenance
  -> stage-aware discovery screen (pure in-process, no remote model)
  -> SHARK wallet entity / developer / independent buyer / synthetic-volume evidence
  -> SHARK rug + sellability + liquidity + migration assessment
  -> MemeTradeAssessment / DecisionProposal (research-only)
  -> canonical Money paper admission + quote-aware shadow
  -> separately governed review before any live capital path
```

The fastest path is a coarse cheap screen immediately after source normalization; asynchronous enrichment can run in parallel but **must not promote an incomplete safety review into entry authority**. Telegram/X/Reddit observations must remain source-deduplicated; personal Telegram listener permissions and terms remain separate. Precomputed creator history helps latency only if the snapshot is independently verified and available by the event cutoff.

**0.616 seconds previously cited in the SHARK acceptance handoff** measures a particular public one-shot that found two candidates, probed both mints, and opened ephemeral unscored cases. It is **not** source-event-to-order latency, transaction landing latency, or a production uptime measurement.

## Next execution sequence

1. **FILTER-05 — source adapter:** capture actual terminal/protocol fee definitions and live on-chain receipts. Version each feed by venue, metric and clock. Never silently equate network base fees, tips and launchpad-reported global fees.
2. **FILTER-06 — cross-module composition:** emit MATCH/REVIEW/SKIP into the current SHARK candidate pipeline. Do not duplicate other SHARK or Money runtimes; reconcile existing open bot PRs (#1409, #1410) before integration.
3. **FILTER-07 — prospective holdout:** evaluate how many launches pass each screen, labeled rug **types**, false rejects, missed runners, time-to-signal, and net *sell-executable* returns versus unfiltered and simpler baselines, including failed/no-fill outcomes.
4. **FILTER-08 — latency and execution costs:** benchmark event visible -> ingest -> normalization -> screen -> safety -> proposal -> quote -> transaction assembly -> submit -> landing -> exit in *independent* shadow simulation. Separate RPC delay, route quality, priority fee, Jito tip, price impact, slippage, token tax, failed orders and MEV inclusion failure. Optimize risk-adjusted net outcomes, not first-look speed alone.
5. **FILTER-09 — owner review:** only after exact-head CI, point-in-time real-data acceptance, persistent host evidence, qualified sell checks and Money approval should the configuration be eligible for a restricted canary. This PR by itself authorizes nothing.

## Local test

```sh
pnpm --filter @jhadina/shark-intelligence-core type-check
pnpm --filter @jhadina/shark-intelligence-core test
```

Tests cover source thresholds, fast mode, metric-kind/unit separation, unknown data, replay chronology, fee provenance and defensive veto dominance. A green code test is not a validated return, an anti-rug accuracy score, or proof of an operational sniper.
