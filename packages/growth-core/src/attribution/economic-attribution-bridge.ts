import type { NormalizedConversionEvent } from './conversion-events.js'

export type EconomicAttribution = {
  eventId: string
  opportunityId: string
  variantId: string
  measurementId: string
  grossRevenue: number
  attributableCosts: number
  contributionProfit: number
  currency: string
  hours?: number
  profitPerHour?: number
}

export type EconomicAttributionInput = {
  conversion: NormalizedConversionEvent
  attributableCosts?: number
  hours?: number
}

export function calculateEconomicAttribution(input: EconomicAttributionInput): EconomicAttribution {
  const revenue = input.conversion.value ?? 0
  const costs = input.attributableCosts ?? 0
  const profit = revenue - costs
  return {
    eventId: input.conversion.eventId,
    opportunityId: input.conversion.opportunityId,
    variantId: input.conversion.variantId,
    measurementId: input.conversion.measurementId,
    grossRevenue: revenue,
    attributableCosts: costs,
    contributionProfit: profit,
    currency: input.conversion.currency ?? 'USD',
    hours: input.hours,
    profitPerHour: input.hours && input.hours > 0 ? profit / input.hours : undefined,
  }
}
