import { describe, expect, it } from 'vitest'
import { CanonicalOpportunityQueue } from './canonical-opportunity-queue.js'
import type { Opportunity } from '../domain/opportunity.js'

const opportunity = (id: string, overall: number, updatedAt: string): Opportunity => ({
  id,
  userId: 'user-1',
  title: id,
  description: 'test opportunity',
  class: 'experiment',
  strategy: 'digital_product',
  source: { type: 'commercial', name: 'test' },
  evidence: [],
  economics: { currency: 'USD', startupCost: 10, estimatedHours: 2, recurringRevenue: false },
  score: { overall, confidence: 0.8 },
  status: 'discovered',
  requiresApproval: true,
  createdAt: updatedAt,
  updatedAt,
})

describe('CanonicalOpportunityQueue', () => {
  it('deduplicates by user and opportunity id and ranks by score', () => {
    const queue = new CanonicalOpportunityQueue()
    queue.ingest([
      opportunity('a', 40, '2026-08-28T00:00:00.000Z'),
      opportunity('b', 90, '2026-08-28T00:01:00.000Z'),
      opportunity('a', 60, '2026-08-28T00:02:00.000Z'),
    ])

    const result = queue.list()
    expect(queue.size()).toBe(2)
    expect(result.map((entry) => entry.opportunity.id)).toEqual(['b', 'a'])
    expect(result.map((entry) => entry.rank)).toEqual([1, 2])
    expect(result[1]?.opportunity.score?.overall).toBe(60)
  })

  it('supports status and source filters', () => {
    const queue = new CanonicalOpportunityQueue()
    queue.ingest([opportunity('a', 80, '2026-08-28T00:00:00.000Z')])
    expect(queue.list({ status: 'discovered', sourceType: 'commercial' })).toHaveLength(1)
    expect(queue.list({ sourceType: 'sam' })).toHaveLength(0)
  })
})
