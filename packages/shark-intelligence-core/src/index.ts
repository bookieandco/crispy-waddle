export type SharkOpportunityKind =
  | 'token'
  | 'pool'
  | 'wallet'
  | 'market'
  | 'mining'
  | 'energy'
  | 'other'

export type SharkDecision =
  | 'observe'
  | 'watch'
  | 'avoid'
  | 'candidate'
  | 'needs_human_review'

export type SharkRisk =
  | 'liquidity'
  | 'holder_concentration'
  | 'contract_control'
  | 'sellability'
  | 'market_structure'
  | 'social_manipulation'
  | 'wallet_behavior'
  | 'source_quality'
  | 'execution'
  | 'unknown'

export type SharkEvidence = {
  sourceId: string
  sourceType: 'onchain' | 'market' | 'social' | 'community' | 'research' | 'system'
  observedAt: string
  signal: string
  strength: number
  verified: boolean
  metadata?: Record<string, string | number | boolean | null>
}

export type SharkStreetSignal = {
  name:
    | 'liquidity_flight'
    | 'insider_accumulation'
    | 'insider_distribution'
    | 'holder_concentration'
    | 'volume_anomaly'
    | 'social_hype_without_depth'
    | 'developer_behavior'
    | 'migration_behavior'
    | 'wash_activity'
    | 'failed_sellability'
  direction: 'positive' | 'negative' | 'unknown'
  strength: number
  rationale: string
  evidenceIds: string[]
}

export type SharkOpportunityDecision = {
  id: string
  opportunityId: string
  kind: SharkOpportunityKind
  decision: SharkDecision
  confidence: number
  expectedValue?: number
  downsideRisk?: number
  risks: SharkRisk[]
  evidence: SharkEvidence[]
  streetSignals: SharkStreetSignal[]
  sourceQuality: number
  novelty: number
  repeatability: number
  monetizationPotential?: number
  productionOrExecutionDifficulty?: number
  policy: {
    policyPassed: boolean
    authorizationRequired: boolean
    authorized: boolean
    executionPermitted: false
  }
  decidedAt: string
  modelVersion?: string
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function validateSharkDecision(decision: SharkOpportunityDecision): string[] {
  const errors: string[] = []

  if (!decision.id) errors.push('id is required')
  if (!decision.opportunityId) errors.push('opportunityId is required')
  if (!decision.decidedAt) errors.push('decidedAt is required')

  for (const [name, value] of [
    ['confidence', decision.confidence],
    ['sourceQuality', decision.sourceQuality],
    ['novelty', decision.novelty],
    ['repeatability', decision.repeatability],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      errors.push(`${name} must be between 0 and 1`)
    }
  }

  if (decision.policy.executionPermitted !== false) {
    errors.push('Shark intelligence cannot authorize execution')
  }

  if (decision.policy.authorized && !decision.policy.authorizationRequired) {
    errors.push('authorized cannot be true when authorizationRequired is false')
  }

  return errors
}
