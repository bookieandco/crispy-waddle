import { describe, expect, it } from 'vitest'
import { CanonicalOpportunityQueue, normalizeLegacyOpportunityQueue } from './canonical-queue'
import type { Opportunity as LegacyOpportunity } from './sideIncome'

const legacy: LegacyOpportunity = {
  id: 'legacy-1',
  userId: 'user-1',
  title: 'AI website service',
  kind: 'automation',
  sourceUrl: 'https://example.com/opportunity',
  sourceName: 'Example',
  summary: 'Build an AI-assisted website for a local business.',
  estimatedPay: { min: 1000, max: 2000, currency: 'USD', cadence: 'per_project' },
  startupCost: 50,
  estimatedHours: 8,
  automationLevel: 'ai_plus_user',
  fitScore: 80,
  riskFlags: [],
  requiresUserApproval: true,
  sourceConfidence: 90,
  status: 'new',
  createdAt: '2026-08-28T00:00:00.000Z',
}

describe('canonical opportunity queue', () => {
  it('normalizes legacy side-income records into the canonical contract', () => {
    const [item] = normalizeLegacyOpportunityQueue([legacy])
    expect(item.id).toBe('legacy-1')
    expect(item.strategy).toBe('service')
    expect(item.source.type).toBe('market_intelligence')
    expect(item.economics.estimatedRevenue).toEqual({ min: 1000, max: 2000 })
    expect(item.status).toBe('discovered')
    expect(item.requiresApproval).toBe(true)
  })

  it('deduplicates canonical records by stable opportunity id', () => {
    const queue = new CanonicalOpportunityQueue()
    const [item] = normalizeLegacyOpportunityQueue([legacy])
    queue.ingest([item])
    queue.ingest([{ ...item, title: 'Updated title' }])
    expect(queue.list()).toHaveLength(1)
    expect(queue.get('legacy-1')?.title).toBe('Updated title')
  })
})
