export type CaptureStrategy = 'BUILD' | 'PARTNER' | 'SUBCONTRACT' | 'ACQUIRE' | 'MIDDLEMANN' | 'REFER'

export type StrategyRouterInput = {
  opportunityId: string
  captureScore: number
  startupCapitalScore: number
  providerAvailabilityScore: number
  acquisitionLeverageScore: number
  middlemanPotentialScore: number
  subcontractPotentialScore: number
  licensingBurdenScore: number
  evidenceIds?: string[]
}

export type StrategyRecommendation = {
  opportunityId: string
  strategies: CaptureStrategy[]
  primaryStrategy: CaptureStrategy
  scores: Record<CaptureStrategy, number>
  rationale: string[]
  evidenceIds: string[]
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const n = (value: number) => clamp(value)

/**
 * Routes an opportunity toward a capture model. This is a recommendation
 * layer only: licensing, contracting, ownership, capacity and legal eligibility
 * must be validated before execution.
 */
export function routeOpportunityStrategy(input: StrategyRouterInput): StrategyRecommendation {
  const capture = n(input.captureScore)
  const capital = n(input.startupCapitalScore)
  const providers = n(input.providerAvailabilityScore)
  const acquisition = n(input.acquisitionLeverageScore)
  const middleman = n(input.middlemanPotentialScore)
  const subcontract = n(input.subcontractPotentialScore)
  const licensing = n(input.licensingBurdenScore)

  const scores: Record<CaptureStrategy, number> = {
    BUILD: clamp(capture * 0.35 + capital * 0.3 + (1 - licensing) * 0.2 + providers * 0.15),
    PARTNER: clamp(providers * 0.45 + capture * 0.25 + (1 - licensing) * 0.15 + middleman * 0.15),
    SUBCONTRACT: clamp(subcontract * 0.45 + providers * 0.3 + capture * 0.25),
    ACQUIRE: clamp(acquisition * 0.55 + capture * 0.25 + providers * 0.2),
    MIDDLEMANN: clamp(middleman * 0.6 + providers * 0.2 + capture * 0.2),
    REFER: clamp(providers * 0.45 + middleman * 0.35 + (1 - capital) * 0.2),
  }

  const strategies = (Object.entries(scores) as [CaptureStrategy, number][])
    .filter(([, score]) => score >= 0.35)
    .sort((a, b) => b[1] - a[1])
    .map(([strategy]) => strategy)

  const primaryStrategy = strategies[0] ?? 'REFER'
  const rationale = [
    ...(primaryStrategy === 'BUILD' ? ['direct fulfillment is comparatively attractive'] : []),
    ...(primaryStrategy === 'PARTNER' ? ['an existing provider base makes partnership attractive'] : []),
    ...(primaryStrategy === 'SUBCONTRACT' ? ['subcontract capacity is a viable capture path'] : []),
    ...(primaryStrategy === 'ACQUIRE' ? ['existing-provider acquisition leverage is strong'] : []),
    ...(primaryStrategy === 'MIDDLEMANN' ? ['coordination/lead-flow leverage may capture value without owning fulfillment'] : []),
    ...(primaryStrategy === 'REFER' ? ['provider leverage is present but direct capture is comparatively weak'] : []),
  ]

  return {
    opportunityId: input.opportunityId,
    strategies,
    primaryStrategy,
    scores,
    rationale,
    evidenceIds: [...new Set(input.evidenceIds ?? [])],
  }
}
