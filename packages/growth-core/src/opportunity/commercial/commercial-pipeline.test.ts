import { describe, expect, it } from 'vitest'
import type { Opportunity, OpportunityRepository } from '../domain/index.js'
import { ingestCommercialOpportunity } from './commercial-pipeline.js'
import type { CommercialOpportunityRecord } from './commercial-opportunity.js'

const record: CommercialOpportunityRecord = {
  externalId: 'offer-42',
  title: 'AI workflow template',
  description: 'A test commercial opportunity',
  kind: 'digital_product',
  source: { name: 'market-test', type: 'digital_product' },
  buyer: { segment: 'small businesses' },
  problem: 'Reduce repetitive work',
  evidence: [{ type: 'market', summary: 'Comparable products observed', confidence: 0.8 }],
  economics: { currency: 'USD', startupCost: 10, estimatedHours: 4, recurringRevenue: false },
}

describe('ingestCommercialOpportunity', () => {
  it('normalizes, scores, queues, and persists one canonical record', async () => {
    const queue = { items: new Map<string, Opportunity>(), ingest(items: readonly Opportunity[]) { for (const item of items) this.items.set(item.id, item); return [...this.items.values()] }, get(id: string) { return this.items.get(id) } }
    const store = new Map<string, Opportunity>()
    const repository: OpportunityRepository = {
      async getById(id) { return store.get(id) ?? null },
      async list() { return [...store.values()] },
      async upsert(opportunity) { store.set(opportunity.id, opportunity); return opportunity },
      async updateStatus(id, status, updatedAt) {
        const existing = store.get(id)
        if (!existing) throw new Error('missing')
        const updated = { ...existing, status, updatedAt }
        store.set(id, updated)
        return updated
      },
    }

    const result = await ingestCommercialOpportunity(record, 'user-1', queue, repository)

    expect(result.id).toBe('commercial:market-test:offer-42')
    expect(result.score).toBeDefined()
    expect(queue.get(result.id)).toEqual(result)
    expect(await repository.getById(result.id)).toEqual(result)
  })
})
