import type { Opportunity } from './opportunity.js'

export type OpportunityScoreFactors = {
  fit: number
  economics: number
  evidence: number
  timing: number
  execution: number
  risk: number
  learning?: number
}

export type OpportunityScoreWeights = {
  fit: number
  economics: number
  evidence: number
  timing: number
  execution: number
  risk: number
  learning: number
}

export type CanonicalOpportunityScore = {
  overall: number
  factors: OpportunityScoreFactors
  weights: OpportunityScoreWeights
  reasons: string[]
}

export const DEFAULT_OPPORTUNITY_SCORE_WEIGHTS: OpportunityScoreWeights = {
  fit: 0.25,
  economics: 0.2,
  evidence: 0.15,
  timing: 0.1,
  execution: 0.15,
  risk: 0.1,
  learning: 0.05,
}

export function scoreOpportunity(
  factors: OpportunityScoreFactors,
  weights: OpportunityScoreWeights = DEFAULT_OPPORTUNITY_SCORE_WEIGHTS,
): CanonicalOpportunityScore {
  for (const [key, value] of Object.entries(factors)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`Opportunity score factor ${key} must be between 0 and 100`)
    }
  }
  const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0)
  if (Math.abs(weightTotal - 1) > 0.000001) throw new Error('Opportunity score weights must sum to 1')

  const learning = factors.learning ?? 50
  const overall = clamp100(
    factors.fit * weights.fit +
    factors.economics * weights.economics +
    factors.evidence * weights.evidence +
    factors.timing * weights.timing +
    factors.execution * weights.execution +
    (100 - factors.risk) * weights.risk +
    learning * weights.learning
  )

  return {
    overall,
    factors: { ...factors, learning },
    weights: { ...weights },
    reasons: [
      `fit=${factors.fit}`,
      `economics=${factors.economics}`,
      `evidence=${factors.evidence}`,
      `timing=${factors.timing}`,
      `execution=${factors.execution}`,
      `risk=${factors.risk}`,
      `learning=${learning}`,
    ],
  }
}

export type OpportunityMatch = {
  opportunityId: string
  eligible: boolean
  capabilityScore: number
  matchedCapabilities: string[]
  capabilityGaps: string[]
  blockers: string[]
  reasons: string[]
  evidenceRefs: string[]
}

export function buildOpportunityMatch(input: {
  opportunity: Opportunity
  requiredCapabilities: string[]
  availableCapabilities: string[]
  blockers?: string[]
  evidenceRefs: string[]
}): OpportunityMatch {
  if (input.evidenceRefs.length === 0 || input.evidenceRefs.some((ref) => !ref.trim())) throw new Error('Opportunity match requires non-empty evidence references')
  const required = uniqueNormalized(input.requiredCapabilities)
  const available = new Set(uniqueNormalized(input.availableCapabilities))
  const matched = required.filter((capability) => available.has(capability))
  const gaps = required.filter((capability) => !available.has(capability))
  const capabilityScore = required.length === 0 ? 100 : Math.round((matched.length / required.length) * 100)
  const blockers = [...new Set(input.blockers ?? [])]
  const eligible = blockers.length === 0 && gaps.length === 0

  return {
    opportunityId: input.opportunity.id,
    eligible,
    capabilityScore,
    matchedCapabilities: matched,
    capabilityGaps: gaps,
    blockers,
    reasons: [
      `${matched.length}/${required.length} required capabilities matched`,
      ...(gaps.length ? [`capability gaps: ${gaps.join(', ')}`] : []),
      ...(blockers.length ? [`blockers: ${blockers.join(', ')}`] : []),
    ],
    evidenceRefs: [...input.evidenceRefs],
  }
}

export function applyOpportunityIntelligence(
  opportunity: Opportunity,
  score: CanonicalOpportunityScore,
  match: OpportunityMatch,
  now = new Date().toISOString(),
): Opportunity {
  if (match.opportunityId !== opportunity.id) throw new Error('Opportunity match does not belong to opportunity')
  return {
    ...opportunity,
    fitScore: score.factors.fit,
    opportunityScore: score.overall,
    metadata: {
      ...opportunity.metadata,
      capabilityScore: match.capabilityScore,
      eligible: match.eligible,
      capabilityGaps: match.capabilityGaps,
      matchBlockers: match.blockers,
    },
    updatedAt: now,
  }
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100))
}

function uniqueNormalized(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))]
}
