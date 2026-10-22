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


## SHARK-FILTER.05 → .09 — implemented continuation (2026-10-21 PDT)

**Source-only delivery: implemented. External commissioning: NOT complete.** This is a continuation of draft PR #1455, not a second scanner, new financial authority, or a live deployment. Do not call this sequence a successful field test, valid rug oracle or profitable bot.

### .05 — source definition and independent receipt adapter

`shark-fee-evidence.ts` holds two *separate* types of evidence:
- Terminal-declared `GLOBAL_FEES_PAID` / `TOTAL_FEES_PAID` metrics, normalized only when mint, metric definition, feed version, venue, evidence ID, observation time, availability time and currency agree. No blanket interpretation of "global fees" is made; the field remains `DECLARED_UNVERIFIED`. Missing, stale, mislabeled and future-available fields fail closed. The fee adapter does not reach out to GMGN, Axion/Axiom or any network. Actual provider-source definitions remain to be independently obtained and certified.
- Read-only Solana transaction fees by independently supplied transaction signature, slot, lamports, provider and observed/available timestamps. Duplicate signatures and future data are rejected. `NETWORK_TX_FEES` are **NOT the same** as terminal global fees; native RPC receipts cannot prove authentic buyers or validate terminal semantics by themselves.

No paid connector, secrets, account session or provider service has been commissioned.

### .06 — preserve canonical assessment + Money boundary

`screened-shark-candidate.ts` combines the discovery result with the existing `MemeTradeAssessment` object:
- screen `MATCH` only -> risk review; missing canonical assessment -> `REVIEW`;
- independent rug blocks, high-risk signals and incomplete coverage veto or downgrade;
- only a screened and fully assessed candidate -> `WATCH_RESEARCH_ONLY`;
- all outcomes explicitly deny signing, money allocation and live execution.

`apps/jhadina-web/src/lib/shark/screened-meme-research-cycle.ts` is an **opt-in app integration function**, not an automatically scheduled service. It returns without database effects for `SKIP`, `BLOCKED` and `REVIEW` and delegates a `MATCH` to the **existing** `runMemeAssessmentCycle` persisted research path exactly once. The existing Money Core policy still governs all financial decisions; this change provides no authority to act.

### .07 — point-in-time holdout scorer

`shark-filter-holdout.ts` accepts prospectively sealed decisions and later, independently labeled source records. Requires a fixed holdout split, one original pair per mint, strictly ordered observation and availability times, independent verdict, and explicit unknown/censored data. Reports:
- stage-screen MATCH / SKIP / REVIEW / BLOCKED counts;
- rug rejection precision/recall, false rejection, missed rugs;
- rejected verified sellable runners versus missing runner labels;
- unknown outcomes, no synthetic successes and no silently omitted dead coins.

It does not train from the full future chart, convert a token price peak into a tradable profit, invent rug identities, or claim accuracy from the supplied two videos. No real holdout case cohort has been ingested or validated as part of this branch.

### .08 — execution latency and quote-cost research

`shark-filter-execution-research.ts` records each provided timestamp along event visible → ingestion → screen → safety → proposal → route quote → build/submit/landing → observed exit. Missing segments remain missing; a 0.616-second research observation cannot become event-to-order or end-to-end exit latency. Research reports distinguish synthetic fixtures from claimed real provider timestamps.

Quote-aware round-trip modeling requires real, time-ordered, mint-bound entry and exit **read-only** DEX quotes. It deducts modeled network/priority/Jito tips, swap charges, slippage, price impact and token taxes **once each as supplied**, without hiding no-fill outcomes. If either quote is missing, unsellable, unsupported or illiquid, the result is `NO_FILL`, not simulated profit. Results are `SHADOW_ESTIMATE_NOT_REALIZED_PNL` and **not evidence of actual fills**, because the code has neither real trade receipts nor a guaranteed execution endpoint. Actual exact-route slippage, MEV impact and priority-fee behavior remain empirical tasks.

### .09 — fail-closed release review

`shark-filter-release-gate.ts` requires an exact repo/CI head, verified provider fee definitions, real read-only observations, independent safety coverage, historical replay, prospectively labeled holdouts, missed-runner audit, executable sell checks, actual end-to-end timing, persistent host/recovery evidence, owner-private alert evidence and Money Core review.

If any required evidence is missing, release gate = `BLOCKED_EVIDENCE`. Passing returns **only** `ELIGIBLE_FOR_OWNER_REVIEW`, never live enabled. It cannot grant signing or spending. Assertions or synthetic fixtures passed as true do not themselves prove real external commissioning; independent receipt audits remain necessary.

### Verifications and limitations

Tests:
```sh
pnpm --filter @jhadina/shark-intelligence-core type-check
pnpm --filter @jhadina/shark-intelligence-core test
pnpm --filter jhadina-web type-check
```
GitHub SHARK Intelligence Core CI / Spatial Conformance / Jhadina Launch Gate must be checked at the **exact final head** after amendments. A green source test does not establish positive trading returns.

Still blocked pending **genuine external evidence**:
1. live terminal global-fee API definition, feed provenance, exact lookback window and independent chain fee validation;
2. provider canary and read-only second-level Solana launch/migration stream, permanent host and tested restore;
3. real sellability, liquidity control, Token-2022 protections, creator/cluster independence and rug classification;
4. hundreds/thousands of prospectively frozen cases across chain/regime/launchpad with independent labels, missed winners and censoring;
5. matching quote route, feasible size, failed exits, measured total latency and fee/MEV receipts;
6. CI exact-head review, user-authorized operational commissioning and separate Money authority.

**Never** turn an imported video threshold into a universal score, price/time guarantee, or automatic trading order.

## SHARK-FILTER.LIVE.10 → .14 — source implementation and acceptance boundaries

Date: October 21, 2026 PDT. Same draft PR #1455 and branch `build/shark-filter-presets-20261021`. **These are reviewable code/test deliverables, not evidence of an always-on market listener or real-money sniper.** Do not merge until exact-head CI passes and the separate SHARK bot/Cloudflare branches are reconciled.

### LIVE.10 — independently bounded public pair adapter

`shark-filter-live-public.ts` normalizes the officially documented public DEX Screener `/token-pairs/v1/solana/{mint}` payload, pinned to an **explicit original pair**, into an evidence-only observation. Network errors, wrong token identity, wrong pair, duplicate pool record, oversized payload and invalid timestamp fail closed. Pair age is based on the provider's `pairCreatedAt` timestamp, **not** independently observed Pump bonding-curve age. The experimental volume field is named hourly (`h1`); this may not equal the time window implied by a video tutorial. DEX public responses have no authenticated `GLOBAL_FEES_PAID` field and do not verify token authority, social identity, pool ownership, sellability or organic volume.

Provider docs: https://docs.dexscreener.com/api/reference. Solana transaction-fee documentation: https://solana.com/docs/rpc/http/gettransaction. These two fee families remain distinct.

### LIVE.11 — one-shot, public-only research canary

`readPublicDexPair` accepts only a base58 token and pair ID, issues **one fixed-provider, GET-only request**, refuses redirects and failures, and uses a strict time limit. No Telegram messages or arbitrary feed listener, credentials, private sessions, wallet addresses, signing, RPC write, cron schedule, purchases or broadcast routes. The caller provides an existing receipt ID; this alone is not tamper-proof or provider-authenticated. Actual cloud deployment and stable host credential/service availability are NOT asserted.

`runPublicFilterCanary` requires separate canonical migration/launch-stage receipt, pair/mint binding, cutoff correctness and evidence IDs before a stage screen runs. Without it, the result is `STAGE_UNVERIFIED`; without terminal-defined fee evidence, the score is `REVIEW`. The output sets `prospectivePaperEntry=false`, `canSign=false` and `canBroadcast=false`, even for a `MATCH`.

Existing real-world bounded research entrypoint to **retain, not duplicate**: `ops/meme/shark_ephemeral_once.py --confirm PUBLIC-SHARK-ONCE-NO-TRADES`, which exercises the existing public-market SHARK worker in disposable local SQLite state. That worker's counts do not establish quick fills, provider authenticity or a continuous service.

### LIVE.12 — original-pair prospective observation cases

`shark-filter-live-paper.ts` seals a snapshot within one minute of the recorded source observation and preserves token and original pair. Subsequent prices can only produce an explicitly **price-only/unverified** fraction after a matching 24–30-hour quote. Missing records, wrong pair or wrong horizon become censored. Future quotes and retroactive sealing fail; no high-watermark, migrated pool switch or later video screenshot can rewrite a historical prediction. No price-only case is a Money Core paper fill or realizable profit.

This pure helper complements rather than replaces the existing `ops/meme/public_alpha_study.py` and `ops/meme/shark_live_intelligence.py` persistent prospective and censoring pathways. Integrating independently observed *live* receipts into their durable ledger, with recovery and off-host encrypted backups, remains an operational commissioning gate.

### LIVE.13 — buy/sell shadow evidence gate

`shark-filter-live-route-review.ts` requires the existing canonical assessed SHARK watch candidate, original-pair-bound entry and exit quote receipts, separately checked fee components (priority gas, Jito tip, swap charges, price impact, slippage, transfer taxes), extension checks and sellability assertions before even reporting an **indicative** shadow delta. Unknown or failed route = `NO_FILL_OR_UNVERIFIED`. That review still sets `moneyCorePaperFill=false`, `realFill=false` and `signerPermitted=false`. This wrapper has no Jupiter signing, wallet authorization or orders. Jupiter quote/read interfaces are rapidly evolving; do not assume an unverified API quote can execute a particular post-migration exit.

### LIVE.14 — fail-closed external acceptance

`shark-filter-live-acceptance.ts` summarizes screened public observations, original-pair price-only marks, censored cases, and indicative shadow reviews. It then uses existing `evaluateSharkFilterReviewGate` requirements; insufficient independently verified provider, fee, sellability, host, exit latency, paper outcomes, holdout, alert and Money Core approval evidence results in **blocked review**. Even a fully populated source fixture cannot activate deployments, keys, money or signing.

### How to test and how not to misinterpret tests

Run source tests through canonical CI:
```sh
pnpm --filter @jhadina/shark-intelligence-core type-check
pnpm --filter @jhadina/shark-intelligence-core test
```
Existing GitHub workflow `SHARK Intelligence Core CI` additionally verifies SHARK integration and persistence contracts. The focused regression file is `packages/shark-intelligence-core/src/meme-trader/__tests__/shark-filter-live-10-14.test.ts`. All test market prices, wallets, pairs, fee records, stage receipts and route flags are explicitly **synthetic fixtures**, not witnessed outcomes or true latency benchmarks.

No operational commissioning was attempted as part of this batch. Host activation, actual published fee definition proof, first mint/migration source, phone delivery, real sellability and prospective case readbacks are not fabricated; the release gate remains fail-closed until independently collected receipts exist.

### Remaining external execution targets

- Connect an **owner-approved** read-only public provider canary to a durable, separately provisioned runtime and establish actual provider/request receipt lineage; benchmark source event visibility separately from polling.
- Prove Pump lifecycle stages, exact mint/pair bindings, creator control, LP authority, buy/sell route/extension checks, priority and Jito fees with independent, timestamped on-chain evidence.
- Accumulate diverse *prospective* frozen cases, including rejected tokens and unavailable followups. Score observed rug subtypes, false rejections, missed sellable runners and matched route-executable net outcomes without censorship bias.
- Test encrypted restore, alerts to the user's device, provider failure/429/timeout recovery, source provenance drift and exact-head CI; request independent Money Core review before any proposal for a live canary.

**Release authority remains NONE. No new fee-bearing resources, deployment, signing, wallet connection, money movement or live trades.**
