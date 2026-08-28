import type { Opportunity } from '../domain/opportunity.js'

export type QueueFilter = { status?: Opportunity['status']; sourceType?: Opportunity['source']['type'] }
export type QueueEntry = { opportunity: Opportunity; rank: number }
const key = (o: Opportunity) => `${o.userId}:${o.id}`
const scoreValue = (o: Opportunity) => o.score?.total ?? 0

export class CanonicalOpportunityQueue {
  private readonly entries = new Map<string, Opportunity>()
  ingest(opportunities: readonly Opportunity[]): QueueEntry[] {
    for (const opportunity of opportunities) {
      const existing = this.entries.get(key(opportunity))
      if (!existing || opportunity.updatedAt >= existing.updatedAt) this.entries.set(key(opportunity), opportunity)
    }
    return this.list()
  }
  list(filter: QueueFilter = {}): QueueEntry[] {
    return [...this.entries.values()]
      .filter(o => !filter.status || o.status === filter.status)
      .filter(o => !filter.sourceType || o.source.type === filter.sourceType)
      .sort((a, b) => scoreValue(b) - scoreValue(a) || b.updatedAt.localeCompare(a.updatedAt))
      .map((opportunity, index) => ({ opportunity, rank: index + 1 }))
  }
  size(): number { return this.entries.size }
}
