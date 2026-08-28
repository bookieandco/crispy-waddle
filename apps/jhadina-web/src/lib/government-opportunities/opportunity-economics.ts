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

function nonNegative(value: number | undefined): number {
  return Math.max(0, value ?? 0)
}

function probability(value: number | undefined): number {
  return Math.max(0, Math.min(1, value ?? 1))
}

/**
 * Computes opportunity-level economics from normalized adapter inputs.
 * Unknown costs remain zero only when the caller explicitly omits them; the
 * confidence field exposes that limitation so ranking code can penalize it.
 */
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

  const providedCostInputs = [input.providerCost, input.fulfillmentCost, input.acquisitionCost]
    .filter((value) => value !== undefined).length
  const confidence = Math.round(
    40 +
      (input.contractValue > 0 ? 20 : 0) +
      Math.min(30, providedCostInputs * 10) +
      (input.probabilityOfWin !== undefined ? 10 : 0),
  )

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
    confidence: Math.min(100, confidence),
  }
}
