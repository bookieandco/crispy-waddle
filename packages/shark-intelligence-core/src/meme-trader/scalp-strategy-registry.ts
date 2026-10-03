export type StrategyStatus = 'CANDIDATE' | 'VALIDATED' | 'RETIRED'
export type StrategySource = 'IMPORTED' | 'OBSERVED' | 'SIMULATED' | 'RESEARCH'

export type ScalpStrategyId =
  | 'NEW_PAIR_POST_BUNDLE_DIP'
  | 'FINAL_STRETCH_FLOOR_RECLAIM'
  | 'FINAL_STRETCH_40_50_DIP'
  | 'TRACKED_DEV_CONSOLIDATION'
  | 'MIGRATED_POST_NUKE_CONSOLIDATION'
  | 'EARLY_GAINER_TREND_CONFIRMATION'
  | 'PUMPFUN_SOCIAL_FLOW_CONFIRMATION'
  | 'DEV_HISTORY_CATALYST_CONTINUATION'
  | 'META_DERIVATIVE_ROTATION'

export type StrategyRule = {
  id: string
  field: string
  operator: 'gte' | 'lte' | 'between' | 'exists' | 'stable'
  value?: number
  upperValue?: number
  required?: boolean
  rationale: string
}

export type ScalpStrategyRule = {
  strategyId: ScalpStrategyId
  name: string
  description: string
  tradeStyle: 'new-pair-speculation' | 'swing-hold' | 'high-conviction' | 'information-edge'
  status: StrategyStatus
  source: StrategySource
  sourceRef: string
  importedAt: string
  confidence: number
  entryRules: StrategyRule[]
  invalidationRules: StrategyRule[]
  profitTaking: {
    mode: 'staged' | 'adaptive'
    targets?: number[]
    requiresLiquidityCheck: boolean
  }
  regimeNotes: string[]
}

/**
 * Candidate strategy knowledge imported from a trader transcript.
 * These are hypotheses, not profitability claims or execution authority.
 * Relative thresholds are deliberately represented as features rather than
 * permanent dollar market-cap constants.
 */
export const IMPORTED_SCALP_STRATEGIES: readonly ScalpStrategyRule[] = [
  {
    strategyId: 'NEW_PAIR_POST_BUNDLE_DIP',
    name: 'New Pair Post-Bundle Dip',
    description: 'Wait for an initial launch expansion and subsequent supply-driven drawdown, then require floor stabilization and real-buy confirmation.',
    tradeStyle: 'new-pair-speculation',
    status: 'CANDIDATE',
    source: 'IMPORTED',
    sourceRef: 'day-4-memecoin-sniping-transcript',
    importedAt: '2026-09-02',
    confidence: 0.25,
    entryRules: [
      { id: 'launch-regime', field: 'marketCapVsLaunchBaseline', operator: 'gte', value: 1.0, required: true, rationale: 'Use the current launch/bonding-curve baseline instead of a fixed dollar threshold.' },
      { id: 'post-run-drawdown', field: 'drawdownFromLocalHigh', operator: 'between', value: 0.5, upperValue: 0.7, required: true, rationale: 'Candidate post-run retracement window from the source transcript.' },
      { id: 'floor', field: 'floorStabilityScore', operator: 'gte', value: 0.6, required: true, rationale: 'A dip alone is not an entry; stabilization is required.' },
      { id: 'flow', field: 'realBuyerConfirmation', operator: 'gte', value: 0.6, required: true, rationale: 'Require evidence of non-bundled demand after the sell-off.' },
      { id: 'supply', field: 'devNetFlowAfterPeak', operator: 'lte', value: 0, required: true, rationale: 'Prefer evidence that tracked initial supply is no longer accumulating.' },
    ],
    invalidationRules: [
      { id: 'breakdown', field: 'floorStabilityScore', operator: 'lte', value: 0.35, required: true, rationale: 'Structural floor failure invalidates the thesis.' },
      { id: 'liquidity', field: 'exitLiquidityScore', operator: 'lte', value: 0.35, required: true, rationale: 'Insufficient exit liquidity invalidates the trade regardless of chart shape.' },
      { id: 'supply-return', field: 'devNetFlowAfterPeak', operator: 'gte', value: 0.25, required: true, rationale: 'Renewed tracked-wallet accumulation can invalidate the supply-exhaustion thesis.' },
    ],
    profitTaking: { mode: 'adaptive', targets: [0.4, 0.6], requiresLiquidityCheck: true },
    regimeNotes: ['The 50–70% drawdown is a candidate range, not a guarantee.', 'Targets must be calibrated after fees, slippage and adverse selection.'],
  },
  {
    strategyId: 'FINAL_STRETCH_FLOOR_RECLAIM',
    name: 'Final Stretch Floor Reclaim',
    description: 'After a large expansion and forced seller exit, enter only when a lower floor stabilizes and demand returns.',
    tradeStyle: 'new-pair-speculation',
    status: 'CANDIDATE',
    source: 'IMPORTED',
    sourceRef: 'day-4-memecoin-sniping-transcript',
    importedAt: '2026-09-02',
    confidence: 0.25,
    entryRules: [
      { id: 'drawdown', field: 'drawdownFromLocalHigh', operator: 'between', value: 0.55, upperValue: 0.75, required: true, rationale: 'Candidate large-drawdown setup.' },
      { id: 'seller-exit', field: 'trackedSellerExhaustionScore', operator: 'gte', value: 0.6, required: true, rationale: 'Avoid buying while the initial supply is still actively distributing.' },
      { id: 'floor', field: 'floorStabilityScore', operator: 'gte', value: 0.6, required: true, rationale: 'Require stabilization before entry.' },
    ],
    invalidationRules: [
      { id: 'floor-break', field: 'floorStabilityScore', operator: 'lte', value: 0.35, required: true, rationale: 'Floor failure invalidates the setup.' },
      { id: 'liquidity', field: 'exitLiquidityScore', operator: 'lte', value: 0.35, required: true, rationale: 'Exit liquidity remains a hard risk constraint.' },
    ],
    profitTaking: { mode: 'adaptive', requiresLiquidityCheck: true },
    regimeNotes: ['Market-cap examples from the source are intentionally not hardcoded.'],
  },
  {
    strategyId: 'FINAL_STRETCH_40_50_DIP',
    name: 'Final Stretch 40–50% Dip',
    description: 'Candidate rebound setup for more established final-stretch coins after a substantial local drawdown.',
    tradeStyle: 'swing-hold',
    status: 'CANDIDATE',
    source: 'IMPORTED',
    sourceRef: 'day-4-memecoin-sniping-transcript',
    importedAt: '2026-09-02',
    confidence: 0.2,
    entryRules: [
      { id: 'regime', field: 'marketCapRegimeScore', operator: 'gte', value: 0.6, required: true, rationale: 'Use a regime score rather than a fixed $15K threshold.' },
      { id: 'drawdown', field: 'drawdownFromLocalHigh', operator: 'between', value: 0.4, upperValue: 0.5, required: true, rationale: 'Candidate 40–50% retracement window.' },
      { id: 'structure', field: 'floorStabilityScore', operator: 'gte', value: 0.6, required: true, rationale: 'Require structural stabilization.' },
    ],
    invalidationRules: [
      { id: 'breakdown', field: 'priceStructureScore', operator: 'lte', value: 0.35, required: true, rationale: 'Structural deterioration invalidates the rebound thesis.' },
      { id: 'liquidity', field: 'exitLiquidityScore', operator: 'lte', value: 0.35, required: true, rationale: 'Liquidity failure invalidates the setup.' },
    ],
    profitTaking: { mode: 'adaptive', requiresLiquidityCheck: true },
    regimeNotes: ['Source used an approximate market-cap floor; Jhadina must learn the appropriate regime boundary from replay data.'],
  },
  {
    strategyId: 'TRACKED_DEV_CONSOLIDATION',
    name: 'Tracked Developer Consolidation',
    description: 'Candidate continuation setup when a historically successful developer wallet has launched and initial supply pressure appears exhausted.',
    tradeStyle: 'high-conviction',
    status: 'CANDIDATE',
    source: 'IMPORTED',
    sourceRef: 'day-4-memecoin-sniping-transcript',
    importedAt: '2026-09-02',
    confidence: 0.2,
    entryRules: [
      { id: 'track-record', field: 'developerTrackRecordScore', operator: 'gte', value: 0.7, required: true, rationale: 'Developer quality must be measured from observed historical outcomes.' },
      { id: 'seller-exhaustion', field: 'trackedSellerExhaustionScore', operator: 'gte', value: 0.6, required: true, rationale: 'Require evidence that initial sellers are exhausted.' },
      { id: 'consolidation', field: 'consolidationStabilityScore', operator: 'gte', value: 0.6, required: true, rationale: 'Require stable consolidation rather than blind copying.' },
    ],
    invalidationRules: [
      { id: 'dev-reversal', field: 'developerNetDistributionRisk', operator: 'gte', value: 0.7, required: true, rationale: 'Material developer distribution invalidates the continuation thesis.' },
      { id: 'structure', field: 'priceStructureScore', operator: 'lte', value: 0.35, required: true, rationale: 'Breakdown invalidates the setup.' },
    ],
    profitTaking: { mode: 'adaptive', requiresLiquidityCheck: true },
    regimeNotes: ['Wallet labels are never trusted without provenance and track-record evidence.', 'A good developer history is a filter, not a guarantee.'],
  },
  {
    strategyId: 'MIGRATED_POST_NUKE_CONSOLIDATION',
    name: 'Migrated Post-Nuke Consolidation',
    description: 'Candidate migrated-token rebound after a severe drawdown followed by stable consolidation above a defended floor.',
    tradeStyle: 'swing-hold',
    status: 'CANDIDATE',
    source: 'IMPORTED',
    sourceRef: 'day-4-memecoin-sniping-transcript',
    importedAt: '2026-09-02',
    confidence: 0.2,
    entryRules: [
      { id: 'migration', field: 'migrationEvidenceScore', operator: 'gte', value: 0.8, required: true, rationale: 'Require observed migration evidence.' },
      { id: 'age', field: 'pairAgeHours', operator: 'between', value: 1, upperValue: 6, required: true, rationale: 'Source describes an early migrated-token window; replay must calibrate it.' },
      { id: 'drawdown', field: 'drawdownFromLocalHigh', operator: 'between', value: 0.6, upperValue: 0.75, required: true, rationale: 'Candidate severe-drawdown window.' },
      { id: 'consolidation', field: 'consolidationStabilityScore', operator: 'gte', value: 0.6, required: true, rationale: 'Require stable consolidation rather than catching a falling knife.' },
    ],
    invalidationRules: [
      { id: 'floor', field: 'floorStabilityScore', operator: 'lte', value: 0.35, required: true, rationale: 'Floor failure invalidates the thesis.' },
      { id: 'liquidity', field: 'exitLiquidityScore', operator: 'lte', value: 0.35, required: true, rationale: 'Exit liquidity is mandatory.' },
    ],
    profitTaking: { mode: 'adaptive', requiresLiquidityCheck: true },
    regimeNotes: ['Source market-cap and age examples are hypotheses, not fixed entry requirements.'],
  },
  {
    strategyId: 'EARLY_GAINER_TREND_CONFIRMATION',
    name: 'Early Gainer Trend Confirmation',
    description: 'Cross-market momentum hypothesis that looks for relatively early venue gainers, confirms higher-timeframe trend quality, then tests lower-timeframe volatility and momentum alignment before entry.',
    tradeStyle: 'information-edge',
    status: 'CANDIDATE',
    source: 'IMPORTED',
    sourceRef: '2026-10-03-binance-early-gainer-transcript',
    importedAt: '2026-10-03',
    confidence: 0.15,
    entryRules: [
      { id: 'early-gain-window', field: 'venueSessionGainFraction', operator: 'between', value: 0.02, upperValue: 0.05, required: true, rationale: 'The source proposes smaller early gainers rather than chasing already-expanded movers; replay must calibrate this window by venue and regime.' },
      { id: 'higher-timeframe-trend', field: 'higherTimeframeTrendQuality', operator: 'gte', value: 0.6, required: true, rationale: 'Require a persistent higher-timeframe uptrend rather than inferring strength from a single move.' },
      { id: 'lower-band-context', field: 'lowerTimeframeMeanReversionSetup', operator: 'gte', value: 0.6, required: true, rationale: 'Represent the source Bollinger-band pullback concept as a measurable setup, not a deterministic buy rule.' },
      { id: 'momentum-confirmation', field: 'lowerTimeframeMomentumConfirmation', operator: 'gte', value: 0.6, required: true, rationale: 'Represent the source MACD confirmation idea as a feature whose incremental value must be tested.' },
    ],
    invalidationRules: [
      { id: 'trend-weakness', field: 'higherTimeframeTrendQuality', operator: 'lte', value: 0.35, required: true, rationale: 'Weak or broken higher-timeframe structure invalidates the setup.' },
      { id: 'late-expansion', field: 'venueSessionGainFraction', operator: 'gte', value: 0.5, required: true, rationale: 'The source explicitly warns against chasing already-large gains; the exact threshold remains a replay variable.' },
      { id: 'liquidity', field: 'exitLiquidityScore', operator: 'lte', value: 0.35, required: true, rationale: 'Technical confirmation never overrides executable-liquidity requirements.' },
    ],
    profitTaking: { mode: 'adaptive', requiresLiquidityCheck: true },
    regimeNotes: [
      'The 2–5% source range is preserved as an imported hypothesis, not a production threshold.',
      'Bollinger-band and MACD observations must be tested for incremental predictive value after fees, spread, slippage and multiple-testing controls.',
      'This strategy may be evaluated on liquid centralized-exchange assets separately from Pump.fun migration strategies.',
    ],
  },
  {
    strategyId: 'PUMPFUN_SOCIAL_FLOW_CONFIRMATION',
    name: 'Pump.fun Social Flow Confirmation',
    description: 'Pump-native discovery hypothesis combining trending acceleration, independent followed-trader activity, callout context and holder quality while penalizing copy-cluster crowding and tracked-actor exits.',
    tradeStyle: 'information-edge',
    status: 'CANDIDATE',
    source: 'IMPORTED',
    sourceRef: '2026-10-03-pumpfun-social-trading-transcript',
    importedAt: '2026-10-03',
    confidence: 0.15,
    entryRules: [
      { id: 'trending-acceleration', field: 'pumpTrendingAccelerationScore', operator: 'gte', value: 0.6, required: true, rationale: 'Trending placement is treated as a discovery signal whose acceleration and latency must be recorded.' },
      { id: 'independent-followed-flow', field: 'followedTraderIndependentFlowScore', operator: 'gte', value: 0.6, required: true, rationale: 'Followed-wallet activity only counts after common-control and copy-cluster deduplication.' },
      { id: 'callout-context', field: 'calloutEvidenceQualityScore', operator: 'gte', value: 0.5, required: false, rationale: 'Social theses/callouts are evidence context, not authority; promotional conflicts and source dependence must be tracked.' },
      { id: 'holder-quality', field: 'holderIndependenceScore', operator: 'gte', value: 0.6, required: true, rationale: 'Require economically independent holder evidence rather than raw holder count.' },
    ],
    invalidationRules: [
      { id: 'copy-crowding', field: 'copyClusterConcentration', operator: 'gte', value: 0.6, required: true, rationale: 'Crowded follower flow can turn an apparent smart-wallet signal into adverse selection.' },
      { id: 'tracked-exit', field: 'trackedActorExitPressure', operator: 'gte', value: 0.6, required: true, rationale: 'Independent evidence of tracked-actor distribution invalidates continuation.' },
      { id: 'promotion-conflict', field: 'promotionConflictRisk', operator: 'gte', value: 0.7, required: true, rationale: 'Undisclosed or economically conflicted promotion materially lowers signal trust.' },
      { id: 'liquidity', field: 'exitLiquidityScore', operator: 'lte', value: 0.35, required: true, rationale: 'Social attention cannot clear a liquidity veto.' },
    ],
    profitTaking: { mode: 'adaptive', requiresLiquidityCheck: true },
    regimeNotes: [
      'Notification speed claims from the source are not trusted without measured event-time latency against on-chain timestamps.',
      'A public trader profile may be downstream of side-wallet or copy-cluster activity, so wallet-graph independence remains mandatory.',
      'This strategy should compete against on-chain-only baselines to measure whether social context adds genuine incremental edge.',
    ],
  },
  {
    strategyId: 'DEV_HISTORY_CATALYST_CONTINUATION',
    name: 'Developer History + Catalyst Continuation',
    description: 'Candidate early-launch continuation when a developer/operator has verified prior launch quality and a concrete external catalyst, claim, or adoption event is independently observed.',
    tradeStyle: 'information-edge',
    status: 'CANDIDATE',
    source: 'IMPORTED',
    sourceRef: '2026-10-03-one-solana-challenge-transcript',
    importedAt: '2026-10-03',
    confidence: 0.15,
    entryRules: [
      { id: 'dev-history', field: 'developerTrackRecordScore', operator: 'gte', value: 0.65, required: true, rationale: 'The source repeatedly favored developers with prior successful bonds/runs; Jhadina must score this from verified historical outcomes, not reputation claims.' },
      { id: 'catalyst', field: 'externalCatalystVerificationScore', operator: 'gte', value: 0.6, required: true, rationale: 'Require an independently observed event such as a creator claim, project post, launch, or public action instead of rumor alone.' },
      { id: 'organic-flow', field: 'realBuyerConfirmation', operator: 'gte', value: 0.55, required: true, rationale: 'Developer history and a catalyst do not replace evidence of real independent demand.' },
      { id: 'sniper-risk', field: 'sniperInventoryRisk', operator: 'lte', value: 0.45, required: true, rationale: 'Large unsold early sniper/bundle inventory can invalidate otherwise attractive early-launch setups.' },
    ],
    invalidationRules: [
      { id: 'dev-distribution', field: 'developerNetDistributionRisk', operator: 'gte', value: 0.7, required: true, rationale: 'Material operator distribution invalidates the continuation thesis.' },
      { id: 'catalyst-failure', field: 'catalystInvalidationScore', operator: 'gte', value: 0.7, required: true, rationale: 'If the expected external action does not occur or is contradicted, the thesis decays.' },
      { id: 'volume-decay', field: 'volumeDecayScore', operator: 'gte', value: 0.7, required: true, rationale: 'The transcript repeatedly exited when motion disappeared; declining participation is an explicit invalidation signal.' },
      { id: 'liquidity', field: 'exitLiquidityScore', operator: 'lte', value: 0.35, required: true, rationale: 'No developer/catalyst signal overrides insufficient exit liquidity.' },
    ],
    profitTaking: { mode: 'adaptive', requiresLiquidityCheck: true },
    regimeNotes: [
      'Prior developer success is a filter, never a guarantee.',
      'Catalyst events must be timestamped and independently verified to avoid lookahead and rumor leakage.',
      'The source challenge used small fixed buys; sizing belongs to Money experiments, not to this SHARK alpha rule.',
    ],
  },
  {
    strategyId: 'META_DERIVATIVE_ROTATION',
    name: 'Meta Derivative Rotation',
    description: 'Candidate short-horizon setup where a dominant narrative/main token creates secondary demand in a clearly related derivative, with entry conditioned on live primary-token strength and exit conditioned on primary/derivative volume decay.',
    tradeStyle: 'new-pair-speculation',
    status: 'CANDIDATE',
    source: 'IMPORTED',
    sourceRef: '2026-10-03-one-solana-challenge-transcript',
    importedAt: '2026-10-03',
    confidence: 0.15,
    entryRules: [
      { id: 'main-strength', field: 'primaryNarrativeFlowScore', operator: 'gte', value: 0.65, required: true, rationale: 'The source repeatedly used a strong main narrative/token as the reason a derivative could receive attention.' },
      { id: 'relationship', field: 'derivativeNarrativeRelationshipScore', operator: 'gte', value: 0.7, required: true, rationale: 'Require a coherent, externally understandable relationship to the primary narrative rather than ticker similarity alone.' },
      { id: 'derivative-flow', field: 'derivativeIndependentFlowScore', operator: 'gte', value: 0.5, required: true, rationale: 'The derivative must show its own independent participation rather than only reflexive copy activity.' },
      { id: 'crowding', field: 'copyClusterConcentration', operator: 'lte', value: 0.5, required: true, rationale: 'Highly concentrated derivative traffic can turn a rotation setup into exit-liquidity risk.' },
    ],
    invalidationRules: [
      { id: 'main-decay', field: 'primaryNarrativeDecayScore', operator: 'gte', value: 0.6, required: true, rationale: 'The transcript repeatedly exited derivatives when the main runner or surrounding meta slowed.' },
      { id: 'derivative-decay', field: 'volumeDecayScore', operator: 'gte', value: 0.7, required: true, rationale: 'No-volume derivatives are explicitly treated as decayed opportunities.' },
      { id: 'bundle-risk', field: 'sniperInventoryRisk', operator: 'gte', value: 0.65, required: true, rationale: 'Large early unsold inventory is an adverse-selection risk.' },
      { id: 'liquidity', field: 'exitLiquidityScore', operator: 'lte', value: 0.35, required: true, rationale: 'Derivative relationships do not clear exit-liquidity requirements.' },
    ],
    profitTaking: { mode: 'adaptive', requiresLiquidityCheck: true },
    regimeNotes: [
      'The transcript explicitly notes derivatives often fail to bond or underperform the primary token; that asymmetry must be modeled.',
      'Primary-token strength and derivative edge must be separated in attribution.',
      'Narrative rotation can decay quickly, so event-time and holding-time distributions are required in replay.',
    ],
  },
]

export function getScalpStrategy(strategyId: ScalpStrategyId): ScalpStrategyRule {
  const strategy = IMPORTED_SCALP_STRATEGIES.find(item => item.strategyId === strategyId)
  if (!strategy) throw new Error(`Unknown scalp strategy: ${strategyId}`)
  return strategy
}
