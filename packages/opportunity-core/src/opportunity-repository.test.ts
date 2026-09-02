import { describe, expect, it } from 'vitest'
import { InMemoryOpportunityRepository } from './opportunity-repository.js'
import type { Opportunity } from './domain/opportunity.js'

const opportunity = (overrides: Partial<Opportunity> = {}): Opportunity => ({
  id: 'oce:test:1',
  title: 'Test opportunity',
  family: 'funding',
  type: 'grant',
  sourceUrl: 'https://example.gov/opportunity/1',
  sourceName: 'Example Government',
  claims: [],
  evidence: [],
  verificationStatus: 'unverified',
  sourceConfidence: 0.8,
  riskFlags: [],
  status: 'discovered',
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  ...overrides,
})

describe('InMemoryOpportunityRepository', () => {
  it('round-trips a defensive copy', async () => {
    const repository = new InMemoryOpportunityRepository()
    const input = opportunity({ claims: [{ id: 'c1', field: 'title', value: 'A', sourceId: 's1', sourceType: 'official', confidence: 0.9, verified: true }] })

    await repository.save(input)
    input.claims[0].value = 'mutated'

    const stored = await repository.get(input.id)
    expect(stored?.claims[0]?.value).toBe('A')
  })

  it('lists only requested ids and preserves repository order', async () => {
    const repository = new InMemoryOpportunityRepository()
    await repository.save(opportunity({ id: 'a' }))
    await repository.save(opportunity({ id: 'b' }))
    await repository.save(opportunity({ id: 'c' }))

    const result = await repository.listByIds(['c', 'a', 'missing'])
    expect(result.map((item) => item.id)).toEqual(['a', 'c'])
  })

  it('filters by lifecycle status', async () => {
    const repository = new InMemoryOpportunityRepository()
    await repository.save(opportunity({ id: 'ready', status: 'ready' }))
    await repository.save(opportunity({ id: 'discovered', status: 'discovered' }))

    expect((await repository.listByStatus('ready')).map((item) => item.id)).toEqual(['ready'])
  })
})
