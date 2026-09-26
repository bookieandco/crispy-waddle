# SHARK / Money Core chat fold — 2026-09-26

Status: **repo-folded / research-only**

Branch: `build/shark-money-chat-fold-2026-09-26`

## Purpose

This handoff folds the 2026-09-25/26 SHARK and Money Core transcript audit into the canonical `bookieandco/crispy-waddle` architecture.

It does **not** create a second trading authority, a second paper engine, or an autonomous execution path.

The controlling boundary remains:

```
market / chain / social evidence
  -> SHARK research + forensics
  -> MemeTradeAssessment / DecisionProposal
  -> SHARK-MONEY governed research envelope
  -> Money Core independent evidence / risk / simulation / authority
  -> governed execution only when separately admitted
```

SHARK remains intelligence/research only. Money Core remains the sole financial/capital/execution authority.

## Existing repository truth preserved

This fold is layered onto the implementation already present on `main`:

- `packages/shark-intelligence-core/src/meme-trader/`
- `apps/jhadina-web/src/lib/shark/money-research-bridge.ts`
- `packages/money-core/src/shark-intelligence-ingress.ts`
- `packages/money-core/src/shark-intelligence-ingress.test.ts`
- `docs/architecture/SHARK-QA17H-READINESS.md`
- `docs/architecture/SHARK-CONVERGE-8-LIVE-COMMISSIONING-2026-09-22.md`
- `docs/architecture/SHARK-CONVERGE-9-PROVIDER-SOAK-2026-09-22.md`
- `packages/jhadina-reference-provenance/src/seed-registry.ts`
- `packages/jhadina-reference-provenance/src/ref-prov-04-seed.ts`
- `docs/architecture/REF-PROV-01-reference-provenance-registry.md`
- `docs/architecture/REF-PROV-02-repository-wide-reference-inventory.md`
- `docs/architecture/REF-PROV-03-source-revision-license-verification.md`

The existing SHARK-MONEY bridge already enforces:

- no SHARK `PROCEED` disposition;
- no financial, capital, protected-fund, or wallet-signing authority;
- immutable evidence;
- point-in-time `availableAt` / information-cutoff integrity;
- preservation of independent source groups;
- contradiction preservation;
- aggregate compatibility only when source independence is not erased.

The current chat-derived work must use those controls rather than bypass them.

## New canonical repo artifact

`packages/shark-intelligence-core/src/meme-trader/research-corpus.ts`

This file is the governed registry for the transcript-derived research families and shared layers. It intentionally records hypotheses and experiment infrastructure without promoting any source claim into production truth.

`research-corpus.test.ts` locks:

- unique module IDs;
- research-only authority;
- no capital/wallet/signing authority;
- duplicate/derivative source copies do not inflate independent evidence;
- independent corroboration remains distinct;
- paper and shadow evidence states remain separate;
- MAKE IT MAKE SENSE runs at hypothesis, trade, and performance stages.

## Canonical research families folded from the chat

### Alpha / discovery / narrative

- `AXIOM_COMMUNITY_DIP_SCALP_V1`
- `NARRATIVE_ACTOR_FLOW_V1`
- `META_FAMILY_TREE_CATALYST_V1`
- `MULTICHAIN_META_ROTATION_V1`
- `VIRALITY_CONVICTION_REENTRY_V1`
- `ECOSYSTEM_FLOW_FLYWHEEL_V1`
- `DISCOVERY_FILTER_PAPERTRADE_V1`
- `STAGE_AWARE_DISCOVERY_FILTER_V4`
- `RWA_MEME_VALUE_ACCRUAL_V1`
- `MEME_REGIME_ROTATION_V1`

Source-specific entry/retracement/filter numbers remain experiment inputs, not universal production rules.

### Forensics / rug / operator intelligence

- `MEME_MANIPULATION_PLAYBOOK_V1` — defensive only
- `CREATOR_REPUTATION_MODEL_V1`
- `SNIPER_DENSITY_MODEL`
- `CHART_ONCHAIN_FUSION_V1`
- `HOLDER_GRAPH_FORENSICS_V1`
- `DEAD_TOKEN_REANIMATION_DETECTOR`
- `HOLDER_UNIFORMITY_DETECTOR`
- `FUNDER_DIVERSITY_CHECK`
- `GLOBAL_FEES_RUG_SIGNAL_EXP_1`
- `EVENT_CORRELATION_VIEW_V1`

No offensive rugging, liquidity theft, mixer use, deceptive bundling, wash volume, impersonation, manipulative launch automation, or market-manipulation implementation is admitted.

### Actor / caller / social intelligence

- `SOCIAL_FEED_SIGNAL_LAYER`
- `ACTOR_EXIT_CASCADE_V1`
- `CALLER_ENSEMBLE_AUTOBOT_V1`
- `CALL_IMPACT_DECAY_V1`
- `SOURCE_POLICY_LEARNER_V1`
- `CALLER_PERFORMANCE_LEDGER_V2`
- `CALLER_TIMELINE_OVERLAY`
- `CALLER_RANK_EXP_1`

Required distinctions:

- transaction != statement;
- raw wallet count != independent actor count;
- repost count != independent evidence count;
- peak token multiple != realizable follower return;
- caller alpha != entry alpha != exit alpha.

### Attention / virality / rotation

- `ATTENTION_CAPITAL_ENGINE_V1`
- `EXTERNAL_VIRALITY_SENSOR_V1`
- `ATTENTION_HALF_LIFE_V1`
- `ATTENTION_PRICE_DIVERGENCE`
- `ROTATION_LIQUIDITY_ENGINE_V1`
- `CAPITAL_DESTINATION_GRAPH`

The intended model is:

```
external event / culture
  -> attention source
  -> crypto interpretation
  -> ticker/token
  -> actor/capital inflow
  -> reflexive price/attention loop
  -> attention decay / rotation
```

### Catalyst / thesis lifecycle

- `CATALYST_LIFECYCLE_ENGINE_V1`
- thesis mutation detection
- expected vs surprise catalyst separation
- priced-in state
- invalidation / expiry
- pre-catalyst, on-catalyst and post-catalyst handling
- opportunity-cost comparison

Universal rule retained: **no position may exist without a current reason for existence.**

### Regime models

- `REGIME_ADAPTIVE_RETRACE_V1`
- `MACRO_EASY_MODE_REGIME_V1`
- `CHAIN_ROTATION_ENGINE_V1`
- `MEME_REGIME_ROTATION_V1`
- `STRATEGY_REGIME_MATRIX`

No historical strategy result is interpreted without market, chain, meta and liquidity regime attribution.

### Behavioral / no-trade controls

- `BEHAVIORAL_EXECUTION_GUARD_V1`
- `NO_TRADE_DISCIPLINE_V1`
- process score vs outcome score
- post-loss tilt
- borrowed conviction
- frequency / filter bypass
- survival budget
- position-size escalation checks

Behavioral guard may deny/downgrade research execution context. It may not grant Money authority.

### Execution intelligence / workspace

- `SHARK_AUTOMATION_EXECUTION_V1`
- `LOW_LATENCY_EXECUTION_BENCH_V1`
- `RPC_ROUTE_BENCHMARKER`
- `SMART_ROUTE_ENGINE_V1`
- `SOLANA_WORKSPACE_ORCHESTRATOR_V1`
- `SHARK_EVENT_LOG_V1`

Latency is decomposed into:

```
event visible
-> ingest
-> features
-> deterministic safety
-> inference
-> decision
-> tx build
-> submit
-> landing
-> confirmation
```

A vendor's fastest subcomponent is never treated as total event-to-fill latency.

### Security / vendor trust

- `VENDOR_TRUST_GATE`
- `TRADING_SECURITY_GUARD`
- `DESKTOP_CLIENT_TRUST_GATE_V1`
- `BROKER_CREDENTIAL_VAULT`

Claims such as non-custodial design, local encryption, audit score, uptime, bug bounty, detection accuracy, MEV protection and security history remain claims until independently verified.

Sell simulation is not equivalent to full rug protection.

### Evidence / provenance

- `SOURCE_DEDUP_PROVENANCE_V1`
- `SOURCE_VERSION_DRIFT_V1`
- `CLAIM_MUTATION_DETECTOR`
- `SHARK_EVIDENCE_PROV_1`
- `PROMOTION_CONFLICT_GRAPH`

Canonical relationships:

- `EXACT_DUPLICATE`
- `NEAR_DUPLICATE`
- `TRANSCRIPT_VARIANT`
- `AFFILIATE_DERIVATIVE`
- `COMMON_ORIGIN`
- `INDEPENDENT_CORROBORATION`
- `INDEPENDENT_CONTRADICTION`

A repeated or slightly rewritten source cannot increase independent evidence weight.

The repeated Pump Sniper scripts in this audit are the canonical regression example: multiple raw observations, one common-origin evidence group unless independent verification exists.

### Experiment / strategy factory

- `MONEY_STRATEGY_FACTORY_V1`
- `STRATEGY_INCUBATION_GATE_V1`
- `BACKTEST_ADVERSARIAL_SUITE`
- `EXPERIMENT_REGISTRY_V1`
- `COUNTERFACTUAL_ENTRY_ENGINE`
- `DEAD_TOKEN_CORPUS`
- `SHADOW_LEDGER_V1`
- `EDGE_DECAY_DETECTOR_V1`
- `SHARK_STRATEGY_FACTORY_1`

Required lifecycle:

```
SOURCE_HYPOTHESIS
-> HISTORICAL_REPLAY
-> OUT_OF_SAMPLE
-> PAPER
-> SHADOW
-> REGIME_REPLICATION
-> LIMITED_CAPITAL_ELIGIBLE
-> MONEY_CORE_REVIEW
```

A strategy cannot promote itself. Proposer, validator, risk authority and executor must remain separate.

Historical replay must preserve `knowledge-as-of` timestamps and include dead/rugged/abandoned/illiquid launches.

### Money research additions

- `OPPORTUNITY_COST_ENGINE`
- `CAPITAL_BUCKET_GOVERNOR_V1`
- `LOTTERY_DEPENDENCE_SCORE`
- `CORRELATED_LP_CARRY_V1`
- `LP_RANGE_GOVERNOR_V1`
- `FEE_YIELD_TRUTH_ENGINE`
- `TOKENIZED_ASSET_PROVENANCE_V1`
- `MEME_LP_BASKET_EXP_1`

LP research must compare net LP performance to a hold benchmark after fees, gas, swaps, rebalances, IL/LVR, adverse selection and wrapper/oracle/counterparty risk. Displayed APR is not accepted as realized APY.

## MAKE IT MAKE SENSE integration

MIMS is now explicitly represented at three stages:

1. **Hypothesis MIMS** — is there a coherent causal reason the proposed edge should exist?
2. **Trade MIMS** — does this candidate actually fit once chronology, independence, manipulation, incentives and alternatives are checked?
3. **Performance MIMS** — does apparent success survive costs, regime attribution, outliers, survivorship bias and alternative explanations?

A claim can make internal sense without being true. MIMS never substitutes for evidence.

## Source-claim quarantine examples

The following kinds of source statements remain `UNVERIFIED_SOURCE_CLAIM` / experiment inputs until independently reproduced:

- exact retracement percentages;
- absolute global-fee thresholds;
- caller/KOL presence as proof of quality;
- "pro holder" presence as proof of legitimacy;
- vendor latency/security/uptime/audit claims;
- AI rug-detection percentages;
- affiliate/vendor P&L screenshots;
- "zero risk" / "money printer" / "easy 2x-4x" language;
- platform-wide trader-loss percentages;
- huge APR/APY claims;
- RWA backing/distribution claims;
- tokenized-equity regulatory or wrapper-equivalence claims.

## Existing GitHub / upstream reference handling

The prior handoff/reference-provenance boundary remains intact.

Repo-traceable provider/runtime references include the current DexScreener, CoinGecko and Helius integrations and the current Pump/Meteora implementation paths.

Existing handoff references such as:

- Pump public docs
- Meteora-Rug-Bot
- wallet-cluster-detector
- `nirholas/pump-fun-sdk`
- `uerax/all-in-one-bot`
- `GeekLad/meteora-profit-analysis`

remain governed by the reference-provenance registry. A named upstream repository does not imply source-code derivation, license clearance, runtime dependency or production trust.

The chat-derived product/tutorial names (Pump Sniper, Solpump, Joule Snipe, FOMO, terminal/workspace demos, AI trading-desk tutorials, etc.) are source material for hypotheses/UX patterns unless separately verified. They are not silently added as runtime dependencies.

## Regression / certification additions

The next certification set should include:

- duplicate transcript -> one independent evidence group;
- affiliate rewrite -> no confidence inflation;
- changed marketing number -> claim-version drift;
- independent source -> separate source group;
- source contradiction -> preserved into Money;
- dead token / rug included in replay corpus;
- no future wallet reputation leakage;
- paper P&L != shadow executable P&L;
- source alpha != entry/exit/routing alpha;
- forensic veto cannot be overridden by alpha;
- NO_TRADE is a valid terminal research decision;
- MIMS hypothesis/trade/performance receipts are distinct;
- Money remains sole financial authority.

## Non-goals of this fold

This branch does not:

- enable live meme trading;
- add wallet signing;
- add Jupiter/Jito execution authority;
- create a second Money simulator;
- authorize copy trading;
- operationalize manipulative launch behavior;
- promote transcript claims into facts;
- change protected-capital policy.

## Next implementation sequence

1. Wire `research-corpus.ts` IDs into the experiment registry/replay format.
2. Add claim/source-family persistence with immutable version history.
3. Build PIT historical replay with a dead-token corpus.
4. Run Filter V1/V2/V3/V4 and minimal control on one corpus.
5. Add actor-flow, caller, catalyst, retracement and attention experiments.
6. Add shadow executable-cost ledger.
7. Attribute results by regime and lottery dependence.
8. Preserve SHARK -> Money research-only ingress for any candidate that survives.

This is now the canonical handoff for the 2026-09-25/26 SHARK / Money Core transcript corpus.
