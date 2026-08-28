export type EconomicsInputs = {
  opportunityId: string
  contractValue: number
  providerCost?: number
  fulfillmentCost?: number
  acquisitionCost?: number
  capitalRequired?: number
  probabilityOfWin?: number
  durationMonths?: number
}

export type OpportunityEconomics = {
  opportunityId: string
  grossRevenue: number
  totalCost: number
  grossProfit: number
  grossMarginPct: number
  expectedValue: number
  capitalRequired: number
  durationMonths: number
  roiOnCapitalPct: number | null
  confidence: number
}

export type CaptureScoringInputs = {
  recurringScore?: number
  competitionScore?: number
  providerAvailabilityScore?: number
  startupCapitalScore?: number
  marginScore?: number
  fulfillmentDifficultyScore?: number
  acquisitionLeverageScore?: number
  middlemanPotentialScore?: number
}

export type OpportunityCaptureAssessment = {
  opportunityId: string
  captureScore: number
  factors: CaptureScoringInputs
  rationale: string[]
}

function nonNegative(value: number | undefined): number {
  return Math.max(0, value ?? 0)
}

function probability(value: number | undefined): number {
  return Math.max(0, Math.min(1, value ?? 1))
}

function score(value: number | undefined): number {
  return Math.max(0, Math.min(1, value ?? 0))
}

/** Computes opportunity-level economics from normalized adapter inputs. */
export function calculateOpportunityEconomics(input: EconomicsInputs): OpportunityEconomics {
  const revenue = nonNegative(input.contractValue)
  const providerCost = nonNegative(input.providerCost)
  const fulfillmentCost = nonNegative(input.fulfillmentCost)
  const acquisitionCost = nonNegative(input.acquisitionCost)
  const capitalRequired = nonNegative(input.capitalRequired)
  const durationMonths = Math.max(1, input.durationMonths ?? 1)
  const winProbability = probability(input.probabilityOfWin)
  const totalCost = providerCost + fulfillmentCost + acquisitionCost
  const grossProfit = revenue - totalCost
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0
  const expectedValue = grossProfit * winProbability
  const roiOnCapitalPct = capitalRequired > 0 ? (expectedValue / capitalRequired) * 100 : null
  const providedCostInputs = [input.providerCost, input.fulfillmentCost, input.acquisitionCost].filter((value) => value !== undefined).length
  const confidence = Math.min(100, Math.round(40 + (input.contractValue > 0 ? 20 : 0) + Math.min(30, providedCostInputs * 10) + (input.probabilityOfWin !== undefined ? 10 : 0)))

  return {
    opportunityId: input.opportunityId,
    grossRevenue: revenue,
    totalCost,
    grossProfit,
    grossMarginPct: Math.round(grossMarginPct * 100) / 100,
    expectedValue,
    capitalRequired,
    durationMonths,
    roiOnCapitalPct: roiOnCapitalPct === null ? null : Math.round(roiOnCapitalPct * 100) / 100,
    confidence,
  }
}

/**
 * Ranks capture attractiveness separately from dollar economics. All factors
 * are normalized 0..1; higher means more attractive. Unknown factors remain 0
 * and therefore cannot masquerade as favorable evidence.
 */
export function assessOpportunityCapture(
  opportunityId: string,
  input: CaptureScoringInputs,
): OpportunityCaptureAssessment {
  const factors: CaptureScoringInputs = {
    recurringScore: score(input.recurringScore),
    competitionScore: score(input.competitionScore),
    providerAvailabilityScore: score(input.providerAvailabilityScore),
    startupCapitalScore: score(input.startupCapitalScore),
    marginScore: score(input.marginScore),
    fulfillmentDifficultyScore: score(input.fulfillmentDifficultyScore),
    acquisitionLeverageScore: score(input.acquisitionLeverageScore),
    middlemanPotentialScore: score(input.middlemanPotentialScore),
  }

  const captureScore = Math.min(1,
    (factors.recurringScore ?? 0) * 0.18 +
    (factors.competitionScore ?? 0) * 0.14 +
    (factors.providerAvailabilityScore ?? 0) * 0.14 +
    (factors.startupCapitalScore ?? 0) * 0.10 +
    (factors.marginScore ?? 0) * 0.16 +
    (factors.fulfillmentDifficultyScore ?? 0) * 0.10 +
    (factors.acquisitionLeverageScore ?? 0) * 0.10 +
    (factors.middlemanPotentialScore ?? 0) * 0.18,
  )

  const rationale = [
    ...((factors.recurringScore ?? 0) >= 0.7 ? ['recurring demand improves revenue durability'] : []),
    ...((factors.competitionScore ?? 0) >= 0.7 ? ['competition profile is favorable'] : []),
    ...((factors.providerAvailabilityScore ?? 0) >= 0.7 ? ['provider capacity supports fulfillment'] : []),
    ...((factors.startupCapitalScore ?? 0) >= 0.7 ? ['startup capital burden appears manageable'] : []),
    ...((factors.marginScore ?? 0) >= 0.7 ? ['margin potential is favorable'] : []),
    ...((factors.fulfillmentDifficultyScore ?? 0) < 0.4 ? ['fulfillment difficulty may constrain capture'] : []),
    ...((factors.acquisitionLeverageScore ?? 0) >= 0.7 ? ['existing-provider acquisition leverage is attractive'] : []),
    ...((factors.middlemanPotentialScore ?? 0) >= 0.7 ? ['coordination/middleman model may be viable'] : []),
  ]

  return { opportunityId, captureScore, factors, rationale }
}
