export type DemandGapInputs = {
  demandScore: number
  competitionScore: number
  providerDensityScore: number
  recurringScore: number
  regulatoryLockInScore: number
  urgencyScore?: number
  ownerLeverageScore?: number
}

export type DemandGapResult = {
  score: number
  tier: 'EXTREME' | 'STRONG' | 'MODERATE' | 'LOW'
  reasons: string[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Deterministic demand-vs-supply signal. Higher scores mean stronger unmet
 * demand relative to competition and provider density. Inputs are normalized
 * to 0..100 by their adapters before reaching this boundary.
 */
export function scoreDemandGap(input: DemandGapInputs): DemandGapResult {
  const demand = clamp(input.demandScore)
  const competition = clamp(input.competitionScore)
  const density = clamp(input.providerDensityScore)
  const recurring = clamp(input.recurringScore)
  const regulatory = clamp(input.regulatoryLockInScore)
  const urgency = clamp(input.urgencyScore ?? 0)
  const leverage = clamp(input.ownerLeverageScore ?? 0)

  const score = Math.round(
    demand * 0.30 +
      (100 - competition) * 0.20 +
      (100 - density) * 0.15 +
      recurring * 0.15 +
      regulatory * 0.10 +
      urgency * 0.05 +
      leverage * 0.05,
  )

  const reasons: string[] = []
  if (demand >= 70) reasons.push('strong measured demand')
  if (competition <= 30) reasons.push('limited observed competition')
  if (density <= 30) reasons.push('low provider density')
  if (recurring >= 70) reasons.push('high recurring-demand signal')
  if (regulatory >= 70) reasons.push('strong regulatory lock-in')
  if (urgency >= 70) reasons.push('urgent demand signal')
  if (leverage >= 70) reasons.push('high owner-leverage potential')

  const tier = score >= 80 ? 'EXTREME' : score >= 65 ? 'STRONG' : score >= 45 ? 'MODERATE' : 'LOW'

  return { score, tier, reasons }
}
