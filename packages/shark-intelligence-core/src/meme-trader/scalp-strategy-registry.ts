export type StrategyStatus = 'CANDIDATE' | 'VALIDATED' | 'RETIRED'
export type StrategySource = 'IMPORTED' | 'OBSERVED' | 'SIMULATED' | 'RESEARCH'

export type ScalpStrategyId =
  | 'NEW_PAIR_POST_BUNDLE_DIP'
  | 'FINAL_STRETCH_FLOOR_RECLAIM'
  | 'FINAL_STRETCH_40_50_DIP'
  | 'TRACKED_DEV_CONSOLIDATION'
  | 'MIGRATED_POST_NUKE_CONSOLIDATION'

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
]

export function getScalpStrategy(strategyId: ScalpStrategyId): ScalpStrategyRule {
  const strategy = IMPORTED_SCALP_STRATEGIES.find(item => item.strategyId === strategyId)
  if (!strategy) throw new Error(`Unknown scalp strategy: ${strategyId}`)
  return strategy
}
