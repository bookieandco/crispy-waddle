export const EDGE_DECISION_FRAMEWORK_VERSION = 'EDGE-001-006-v1' as const

export type EdgeType = 'INFORMATION' | 'ANALYTICAL' | 'BEHAVIORAL' | 'QUANTITATIVE'

export type EdgeGateId =
  | 'EDGE-001'
  | 'EDGE-002'
  | 'EDGE-003'
  | 'EDGE-004'
  | 'EDGE-005'
  | 'EDGE-006'

export type EdgeGateReceipt = Readonly<{
  gateId: EdgeGateId
  version: typeof EDGE_DECISION_FRAMEWORK_VERSION
  disposition: 'PASS' | 'BLOCK'
  reasonCodes: readonly string[]
  evidenceIds: readonly string[]
  evaluatedAt: string
  authority: 'RESEARCH_AND_RISK_GATE_ONLY'
  canAuthorizeTrade: false
}>

export type Edge001Input = Readonly<{
  evaluatedAt: string
  edgeTypes: readonly EdgeType[]
  marketMispricingHypothesis: string
  expectedFutureBuyer: string
  evidenceIds: readonly string[]
}>

export type Edge002Input = Readonly<{
  evaluatedAt: string
  marketDisagreementScore: number
  expectedUpsideMultiple: number
  maxLossFraction: number
  minimumDisagreementScore?: number
  minimumRewardRiskRatio?: number
  evidenceIds: readonly string[]
}>

export type Edge003Input = Readonly<{
  evaluatedAt: string
  portfolioValueUsd: number
  acceptableLossUsd: number
  entryPrice: number
  invalidationPrice: number
  maxPositionFraction: number
  executableLiquidityUsd: number
  maxLiquidityTakeFraction?: number
  evidenceIds: readonly string[]
}>

export type Edge003Sizing = Readonly<{
  receipt: EdgeGateReceipt
  lossLimitedNotionalUsd: number
  portfolioLimitedNotionalUsd: number
  liquidityLimitedNotionalUsd: number
  approvedNotionalUsd: number
}>

export type Edge004Input = Readonly<{
  evaluatedAt: string
  observedAt: string
  trendScore: number
  sourceCount: number
  catalyst: string
  narrative: string
  expectedFutureBuyer: string
  maximumAgeSeconds?: number
  minimumTrendScore?: number
  evidenceIds: readonly string[]
}>

export type Edge005Input = Readonly<{
  evaluatedAt: string
  liquidCapitalUsd: number
  proposedNotionalUsd: number
  reservedCapitalUsd: number
  minimumDryPowderUsd: number
  executableExitLiquidityUsd: number
  minimumExitCoverageMultiple?: number
  evidenceIds: readonly string[]
}>

export type Edge006Input = Readonly<{
  evaluatedAt: string
  remainingMoveFraction: number
  executableSizeFraction: number
  liquidityConfidence: number
  thesisConfidence: number
  minimumOpportunityScore?: number
  evidenceIds: readonly string[]
}>

export type Edge006Result = Readonly<{
  receipt: EdgeGateReceipt
  opportunityScore: number
}>

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function unit(value: number): boolean {
  return finite(value) && value >= 0 && value <= 1
}

function positive(value: number): boolean {
  return finite(value) && value > 0
}

function validIso(value: string): boolean {
  return Boolean(value.trim()) && !Number.isNaN(Date.parse(value))
}

function receipt(
  gateId: EdgeGateId,
  evaluatedAt: string,
  reasons: readonly string[],
  evidenceIds: readonly string[],
): EdgeGateReceipt {
  return Object.freeze({
    gateId,
    version: EDGE_DECISION_FRAMEWORK_VERSION,
    disposition: reasons.length ? 'BLOCK' : 'PASS',
    reasonCodes: Object.freeze([...new Set(reasons)]),
    evidenceIds: Object.freeze([...new Set(evidenceIds)]),
    evaluatedAt,
    authority: 'RESEARCH_AND_RISK_GATE_ONLY',
    canAuthorizeTrade: false,
  })
}

function common(gateId: EdgeGateId, evaluatedAt: string, evidenceIds: readonly string[]): string[] {
  const reasons: string[] = []
  if (!validIso(evaluatedAt)) reasons.push(`${gateId.replace('-','')}_EVALUATED_AT_INVALID`)
  if (!evidenceIds.length) reasons.push(`${gateId.replace('-','')}_EVIDENCE_REQUIRED`)
  return reasons
}

export function evaluateEdge001(input: Edge001Input): EdgeGateReceipt {
  const reasons = common('EDGE-001', input.evaluatedAt, input.evidenceIds)
  if (!input.edgeTypes.length) reasons.push('EDGE001_EDGE_DECLARATION_REQUIRED')
  if (!input.marketMispricingHypothesis.trim()) reasons.push('EDGE001_MISPRICING_HYPOTHESIS_REQUIRED')
  if (!input.expectedFutureBuyer.trim()) reasons.push('EDGE001_FUTURE_BUYER_REQUIRED')
  return receipt('EDGE-001', input.evaluatedAt, reasons, input.evidenceIds)
}

export function evaluateEdge002(input: Edge002Input): EdgeGateReceipt {
  const reasons = common('EDGE-002', input.evaluatedAt, input.evidenceIds)
  const minimumDisagreementScore = input.minimumDisagreementScore ?? 0.25
  const minimumRewardRiskRatio = input.minimumRewardRiskRatio ?? 2
  if (!unit(input.marketDisagreementScore)) reasons.push('EDGE002_DISAGREEMENT_SCORE_INVALID')
  if (!positive(input.expectedUpsideMultiple) || input.expectedUpsideMultiple <= 1) reasons.push('EDGE002_UPSIDE_REQUIRED')
  if (!positive(input.maxLossFraction) || input.maxLossFraction > 1) reasons.push('EDGE002_MAX_LOSS_INVALID')
  if (!unit(minimumDisagreementScore)) reasons.push('EDGE002_DISAGREEMENT_THRESHOLD_INVALID')
  if (!positive(minimumRewardRiskRatio)) reasons.push('EDGE002_REWARD_RISK_THRESHOLD_INVALID')
  if (unit(input.marketDisagreementScore) && input.marketDisagreementScore < minimumDisagreementScore) reasons.push('EDGE002_DISAGREEMENT_INSUFFICIENT')
  const upsideFraction = positive(input.expectedUpsideMultiple) ? input.expectedUpsideMultiple - 1 : 0
  const rr = positive(input.maxLossFraction) ? upsideFraction / input.maxLossFraction : 0
  if (finite(rr) && rr < minimumRewardRiskRatio) reasons.push('EDGE002_ASYMMETRY_INSUFFICIENT')
  return receipt('EDGE-002', input.evaluatedAt, reasons, input.evidenceIds)
}

export function evaluateEdge003(input: Edge003Input): Edge003Sizing {
  const reasons = common('EDGE-003', input.evaluatedAt, input.evidenceIds)
  const maxLiquidityTakeFraction = input.maxLiquidityTakeFraction ?? 0.02
  for (const [value, code] of [
    [input.portfolioValueUsd, 'EDGE003_PORTFOLIO_VALUE_INVALID'],
    [input.acceptableLossUsd, 'EDGE003_ACCEPTABLE_LOSS_INVALID'],
    [input.entryPrice, 'EDGE003_ENTRY_PRICE_INVALID'],
    [input.invalidationPrice, 'EDGE003_INVALIDATION_PRICE_INVALID'],
    [input.executableLiquidityUsd, 'EDGE003_LIQUIDITY_INVALID'],
  ] as const) if (!positive(value)) reasons.push(code)
  if (!unit(input.maxPositionFraction) || input.maxPositionFraction <= 0) reasons.push('EDGE003_MAX_POSITION_FRACTION_INVALID')
  if (!unit(maxLiquidityTakeFraction) || maxLiquidityTakeFraction <= 0) reasons.push('EDGE003_MAX_LIQUIDITY_TAKE_INVALID')

  const stopFraction = positive(input.entryPrice)
    ? Math.abs(input.entryPrice - input.invalidationPrice) / input.entryPrice
    : 0
  if (!positive(stopFraction)) reasons.push('EDGE003_INVALIDATION_DISTANCE_REQUIRED')
  if (positive(input.acceptableLossUsd) && positive(input.portfolioValueUsd) && input.acceptableLossUsd > input.portfolioValueUsd) {
    reasons.push('EDGE003_LOSS_BUDGET_EXCEEDS_PORTFOLIO')
  }

  const lossLimitedNotionalUsd = positive(stopFraction) ? input.acceptableLossUsd / stopFraction : 0
  const portfolioLimitedNotionalUsd = unit(input.maxPositionFraction) ? input.portfolioValueUsd * input.maxPositionFraction : 0
  const liquidityLimitedNotionalUsd = unit(maxLiquidityTakeFraction) ? input.executableLiquidityUsd * maxLiquidityTakeFraction : 0
  const approvedNotionalUsd = Math.max(0, Math.min(lossLimitedNotionalUsd, portfolioLimitedNotionalUsd, liquidityLimitedNotionalUsd))
  if (!positive(approvedNotionalUsd)) reasons.push('EDGE003_NO_EXECUTABLE_SIZE')

  return Object.freeze({
    receipt: receipt('EDGE-003', input.evaluatedAt, reasons, input.evidenceIds),
    lossLimitedNotionalUsd,
    portfolioLimitedNotionalUsd,
    liquidityLimitedNotionalUsd,
    approvedNotionalUsd,
  })
}

export function evaluateEdge004(input: Edge004Input): EdgeGateReceipt {
  const reasons = common('EDGE-004', input.evaluatedAt, input.evidenceIds)
  const maximumAgeSeconds = input.maximumAgeSeconds ?? 300
  const minimumTrendScore = input.minimumTrendScore ?? 0.5
  if (!validIso(input.observedAt)) reasons.push('EDGE004_OBSERVED_AT_INVALID')
  if (!unit(input.trendScore)) reasons.push('EDGE004_TREND_SCORE_INVALID')
  if (!Number.isInteger(input.sourceCount) || input.sourceCount < 1) reasons.push('EDGE004_SOURCE_COUNT_INVALID')
  if (!input.catalyst.trim()) reasons.push('EDGE004_CATALYST_REQUIRED')
  if (!input.narrative.trim()) reasons.push('EDGE004_NARRATIVE_REQUIRED')
  if (!input.expectedFutureBuyer.trim()) reasons.push('EDGE004_FUTURE_BUYER_REQUIRED')
  if (!positive(maximumAgeSeconds)) reasons.push('EDGE004_MAXIMUM_AGE_INVALID')
  if (!unit(minimumTrendScore)) reasons.push('EDGE004_TREND_THRESHOLD_INVALID')
  if (unit(input.trendScore) && input.trendScore < minimumTrendScore) reasons.push('EDGE004_TREND_TOO_WEAK')
  if (input.sourceCount < 2) reasons.push('EDGE004_CROSS_SOURCE_CONFIRMATION_REQUIRED')
  if (validIso(input.evaluatedAt) && validIso(input.observedAt)) {
    const ageSeconds = (Date.parse(input.evaluatedAt) - Date.parse(input.observedAt)) / 1000
    if (ageSeconds < 0) reasons.push('EDGE004_FUTURE_EVIDENCE_FORBIDDEN')
    else if (ageSeconds > maximumAgeSeconds) reasons.push('EDGE004_NARRATIVE_STALE')
  }
  return receipt('EDGE-004', input.evaluatedAt, reasons, input.evidenceIds)
}

export function evaluateEdge005(input: Edge005Input): EdgeGateReceipt {
  const reasons = common('EDGE-005', input.evaluatedAt, input.evidenceIds)
  const minimumExitCoverageMultiple = input.minimumExitCoverageMultiple ?? 3
  for (const [value, code] of [
    [input.liquidCapitalUsd, 'EDGE005_LIQUID_CAPITAL_INVALID'],
    [input.proposedNotionalUsd, 'EDGE005_PROPOSED_NOTIONAL_INVALID'],
    [input.executableExitLiquidityUsd, 'EDGE005_EXIT_LIQUIDITY_INVALID'],
  ] as const) if (!positive(value)) reasons.push(code)
  if (!finite(input.reservedCapitalUsd) || input.reservedCapitalUsd < 0) reasons.push('EDGE005_RESERVED_CAPITAL_INVALID')
  if (!finite(input.minimumDryPowderUsd) || input.minimumDryPowderUsd < 0) reasons.push('EDGE005_DRY_POWDER_MINIMUM_INVALID')
  if (!positive(minimumExitCoverageMultiple)) reasons.push('EDGE005_EXIT_COVERAGE_THRESHOLD_INVALID')

  const dryPowderAfter = input.liquidCapitalUsd - input.reservedCapitalUsd - input.proposedNotionalUsd
  if (finite(dryPowderAfter) && dryPowderAfter < input.minimumDryPowderUsd) reasons.push('EDGE005_DRY_POWDER_BOUNDARY_BREACHED')
  if (positive(input.proposedNotionalUsd) && input.executableExitLiquidityUsd / input.proposedNotionalUsd < minimumExitCoverageMultiple) {
    reasons.push('EDGE005_EXIT_LIQUIDITY_INSUFFICIENT')
  }
  return receipt('EDGE-005', input.evaluatedAt, reasons, input.evidenceIds)
}

export function evaluateEdge006(input: Edge006Input): Edge006Result {
  const reasons = common('EDGE-006', input.evaluatedAt, input.evidenceIds)
  const minimumOpportunityScore = input.minimumOpportunityScore ?? 0.1
  for (const [value, code] of [
    [input.remainingMoveFraction, 'EDGE006_REMAINING_MOVE_INVALID'],
    [input.executableSizeFraction, 'EDGE006_EXECUTABLE_SIZE_INVALID'],
    [input.liquidityConfidence, 'EDGE006_LIQUIDITY_CONFIDENCE_INVALID'],
    [input.thesisConfidence, 'EDGE006_THESIS_CONFIDENCE_INVALID'],
  ] as const) if (!unit(value)) reasons.push(code)
  if (!unit(minimumOpportunityScore)) reasons.push('EDGE006_OPPORTUNITY_THRESHOLD_INVALID')
  const opportunityScore =
    (unit(input.remainingMoveFraction) ? input.remainingMoveFraction : 0) *
    (unit(input.executableSizeFraction) ? input.executableSizeFraction : 0) *
    (unit(input.liquidityConfidence) ? input.liquidityConfidence : 0) *
    (unit(input.thesisConfidence) ? input.thesisConfidence : 0)
  if (opportunityScore < minimumOpportunityScore) reasons.push('EDGE006_SIZE_TIMING_OPPORTUNITY_INSUFFICIENT')
  return Object.freeze({
    receipt: receipt('EDGE-006', input.evaluatedAt, reasons, input.evidenceIds),
    opportunityScore,
  })
}

export type EdgeDecisionBundle = Readonly<{
  frameworkVersion: typeof EDGE_DECISION_FRAMEWORK_VERSION
  receipts: readonly EdgeGateReceipt[]
  disposition: 'PASS' | 'BLOCK'
  reasonCodes: readonly string[]
  evidenceIds: readonly string[]
  authority: 'RESEARCH_AND_RISK_GATE_ONLY'
  canAuthorizeTrade: false
}>

export function createEdgeDecisionBundle(receipts: readonly EdgeGateReceipt[]): EdgeDecisionBundle {
  const required: readonly EdgeGateId[] = ['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006']
  const byId = new Map(receipts.map((item) => [item.gateId, item]))
  const reasons: string[] = []
  for (const gateId of required) {
    const item = byId.get(gateId)
    if (!item) reasons.push(`${gateId.replace('-','')}_RECEIPT_REQUIRED`)
    else {
      if (item.version !== EDGE_DECISION_FRAMEWORK_VERSION) reasons.push(`${gateId.replace('-','')}_VERSION_INVALID`)
      if (item.authority !== 'RESEARCH_AND_RISK_GATE_ONLY' || item.canAuthorizeTrade !== false) reasons.push(`${gateId.replace('-','')}_AUTHORITY_INVALID`)
      if (item.disposition !== 'PASS' || item.reasonCodes.length) reasons.push(`${gateId.replace('-','')}_BLOCKED`)
      if (!item.evidenceIds.length) reasons.push(`${gateId.replace('-','')}_EVIDENCE_REQUIRED`)
    }
  }
  return Object.freeze({
    frameworkVersion: EDGE_DECISION_FRAMEWORK_VERSION,
    receipts: Object.freeze([...receipts]),
    disposition: reasons.length ? 'BLOCK' : 'PASS',
    reasonCodes: Object.freeze([...new Set(reasons)]),
    evidenceIds: Object.freeze([...new Set(receipts.flatMap((item) => item.evidenceIds))]),
    authority: 'RESEARCH_AND_RISK_GATE_ONLY',
    canAuthorizeTrade: false,
  })
}
