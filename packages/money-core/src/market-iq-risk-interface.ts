import type {
  CrowdQualityAssessment,
  MarketImpactElasticity,
  MarketTruthAssessment,
  NetExecutableEdge,
} from '@jhadina/market-intelligence-core'

export const MARKET_IQ_MONEY_RISK_INTERFACE_VERSION = 'MONEY-MARKET-IQ-RISK-1' as const

export type MarketIqRiskPolicy = Readonly<{
  minimumNetEdge?: number
  minimumCrowdQuality?: number
  maximumImpactPerThousandUsd?: number
  maximumTruthContradictionRisk?: number
  minimumTruthCoverage?: number
}>

export type MarketIqMoneyRiskContext = Readonly<{
  version: typeof MARKET_IQ_MONEY_RISK_INTERFACE_VERSION
  subjectId: string
  evaluatedAt: string
  riskState: 'CLEAR' | 'ELEVATED' | 'UNKNOWN'
  reasonCodes: readonly string[]
  evaluatedMetrics: readonly string[]
  authority: 'RISK_CONTEXT_ONLY'
  financialAuthority: 'NONE'
  canAuthorizeCapital: false
  canAuthorizeTrade: false
  canExecute: false
}>

const unit = (value: number, code: string): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(code)
}

export function buildMarketIqMoneyRiskContext(input: Readonly<{
  subjectId: string
  evaluatedAt: string
  policy: MarketIqRiskPolicy
  executableEdge?: NetExecutableEdge | null
  crowdQuality?: CrowdQualityAssessment | null
  marketImpact?: MarketImpactElasticity | null
  truth?: MarketTruthAssessment | null
}>): MarketIqMoneyRiskContext {
  if (!input.subjectId.trim()) throw new Error('MONEY_MARKET_IQ_RISK_SUBJECT_REQUIRED')
  if (Number.isNaN(Date.parse(input.evaluatedAt))) throw new Error('MONEY_MARKET_IQ_RISK_TIME_INVALID')
  if (input.policy.minimumCrowdQuality !== undefined) unit(input.policy.minimumCrowdQuality, 'MONEY_MARKET_IQ_RISK_CROWD_POLICY_INVALID')
  if (input.policy.maximumTruthContradictionRisk !== undefined) unit(input.policy.maximumTruthContradictionRisk, 'MONEY_MARKET_IQ_RISK_TRUTH_POLICY_INVALID')
  if (input.policy.minimumTruthCoverage !== undefined) unit(input.policy.minimumTruthCoverage, 'MONEY_MARKET_IQ_RISK_COVERAGE_POLICY_INVALID')
  if (
    input.policy.maximumImpactPerThousandUsd !== undefined &&
    (!Number.isFinite(input.policy.maximumImpactPerThousandUsd) || input.policy.maximumImpactPerThousandUsd < 0)
  ) {
    throw new Error('MONEY_MARKET_IQ_RISK_IMPACT_POLICY_INVALID')
  }
  if (
    input.policy.minimumNetEdge !== undefined &&
    !Number.isFinite(input.policy.minimumNetEdge)
  ) {
    throw new Error('MONEY_MARKET_IQ_RISK_EDGE_POLICY_INVALID')
  }

  const reasons: string[] = []
  const evaluated: string[] = []

  if (input.policy.minimumNetEdge !== undefined) {
    if (!input.executableEdge) reasons.push('MARKET_IQ_NET_EDGE_MISSING')
    else {
      evaluated.push('NET_EXECUTABLE_EDGE')
      if (input.executableEdge.netEdge < input.policy.minimumNetEdge) reasons.push('MARKET_IQ_NET_EDGE_BELOW_POLICY')
    }
  }

  if (input.policy.minimumCrowdQuality !== undefined) {
    if (!input.crowdQuality) reasons.push('MARKET_IQ_CROWD_QUALITY_MISSING')
    else {
      evaluated.push('CROWD_QUALITY')
      if (input.crowdQuality.qualityScore < input.policy.minimumCrowdQuality) reasons.push('MARKET_IQ_CROWD_QUALITY_BELOW_POLICY')
    }
  }

  if (input.policy.maximumImpactPerThousandUsd !== undefined) {
    if (!input.marketImpact) reasons.push('MARKET_IQ_MARKET_IMPACT_MISSING')
    else {
      evaluated.push('MARKET_IMPACT_ELASTICITY')
      if (input.marketImpact.impactPerThousandUsd > input.policy.maximumImpactPerThousandUsd) {
        reasons.push('MARKET_IQ_MARKET_IMPACT_ABOVE_POLICY')
      }
    }
  }

  if (
    input.policy.maximumTruthContradictionRisk !== undefined ||
    input.policy.minimumTruthCoverage !== undefined
  ) {
    if (!input.truth) reasons.push('MARKET_IQ_TRUTH_MISSING')
    else {
      evaluated.push('MARKET_TRUTH')
      if (
        input.policy.maximumTruthContradictionRisk !== undefined &&
        (input.truth.contradictionRisk === null ||
          input.truth.contradictionRisk > input.policy.maximumTruthContradictionRisk)
      ) {
        reasons.push('MARKET_IQ_TRUTH_CONTRADICTION_ABOVE_POLICY')
      }
      if (
        input.policy.minimumTruthCoverage !== undefined &&
        input.truth.coverage < input.policy.minimumTruthCoverage
      ) {
        reasons.push('MARKET_IQ_TRUTH_COVERAGE_BELOW_POLICY')
      }
    }
  }

  const configuredMetrics = Object.values(input.policy).filter((value) => value !== undefined).length
  const riskState: MarketIqMoneyRiskContext['riskState'] =
    configuredMetrics === 0 ? 'UNKNOWN' : reasons.length ? 'ELEVATED' : 'CLEAR'

  return Object.freeze({
    version: MARKET_IQ_MONEY_RISK_INTERFACE_VERSION,
    subjectId: input.subjectId,
    evaluatedAt: input.evaluatedAt,
    riskState,
    reasonCodes: Object.freeze([...new Set(reasons)].sort()),
    evaluatedMetrics: Object.freeze([...new Set(evaluated)].sort()),
    authority: 'RISK_CONTEXT_ONLY',
    financialAuthority: 'NONE',
    canAuthorizeCapital: false,
    canAuthorizeTrade: false,
    canExecute: false,
  })
}
