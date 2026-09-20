import type { Opportunity } from '@jhadina/growth-core'
import { adaptLegacyOpportunities } from './canonical-adapter'
import type { Opportunity as LegacyOpportunity } from './sideIncome'

/**
 * Single in-process normalization boundary for the web app.
 * Persistence belongs behind OpportunityRepository; this queue intentionally
 * does not invent a second database or mutate source records.
 */
export class CanonicalOpportunityQueue {
  private readonly items = new Map<string, Opportunity>()

  ingest(opportunities: readonly Opportunity[]): Opportunity[] {
    for (const opportunity of opportunities) this.items.set(opportunity.id, opportunity)
    return this.list()
  }

  ingestLegacy(opportunities: readonly LegacyOpportunity[]): Opportunity[] {
    return this.ingest(adaptLegacyOpportunities([...opportunities]))
  }

  list(): Opportunity[] {
    return [...this.items.values()]
  }

  get(id: string): Opportunity | undefined {
    return this.items.get(id)
  }

  clear(): void {
    this.items.clear()
  }
}

export function normalizeLegacyOpportunityQueue(items: readonly LegacyOpportunity[]): Opportunity[] {
  return adaptLegacyOpportunities([...items])
}
