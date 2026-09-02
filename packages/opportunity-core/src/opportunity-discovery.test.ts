import { describe, expect, it } from 'vitest'
import { InMemoryOpportunityRepository } from './opportunity-repository.js'
import { OpportunityDiscoveryProviderRegistry, OpportunityDiscoveryService } from './opportunity-discovery.js'
import type { Opportunity } from './domain/opportunity.js'
import type { OpportunitySource } from './domain/source.js'

const source: OpportunitySource = {
  id: 'us.test.source', name: 'Test Source', publisher: 'Test', class: 'government', authority: 'official',
  countryCodes: ['US'], opportunityTypes: ['grant'], officialUrl: 'https://example.gov', active: true,
}
const inactiveSource: OpportunitySource = { ...source, id: 'us.inactive.source', active: false }
const opportunity = (id = 'oce:test:1'): Opportunity => ({
  id, title: 'Test grant', family: 'funding', type: 'grant', sourceUrl: source.officialUrl, sourceName: source.name,
  sourceId: source.id, claims: [{ id: 'claim:1', field: 'title', value: 'Test grant', sourceId: source.id, sourceType: 'official', confidence: 1, verified: true }],
  evidence: [{ id: 'evidence:1', sourceId: source.id, sourceUrl: source.officialUrl, sourceName: source.name, sourceType: 'official', capturedAt: '2026-09-02T00:00:00.000Z', confidence: 1 }],
  verificationStatus: 'verified', sourceConfidence: 1, riskFlags: [], status: 'ready', createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
})

const provider = (providerSource = source): { source: OpportunitySource; discover: () => Promise<[{ opportunity: Opportunity; source: OpportunitySource }]> } => ({
  source: providerSource,
  async discover() { return [{ opportunity: opportunity(), source: providerSource }] },
})

describe('OpportunityDiscoveryProviderRegistry', () => {
  it('indexes providers by unique active source id', () => {
    const registry = new OpportunityDiscoveryProviderRegistry([provider()])
    expect(registry.get(source.id)).toBeDefined()
    expect(registry.list()).toHaveLength(1)
  })

  it('rejects duplicate source ids', () => {
    expect(() => new OpportunityDiscoveryProviderRegistry([provider(), provider()])).toThrow('duplicate opportunity discovery provider source')
  })

  it('rejects inactive sources instead of silently skipping them', () => {
    expect(() => new OpportunityDiscoveryProviderRegistry([provider(inactiveSource)])).toThrow('inactive opportunity source cannot be registered')
  })
})

describe('OpportunityDiscoveryService', () => {
  it('normalizes valid provider output into the repository', async () => {
    const repository = new InMemoryOpportunityRepository()
    const service = new OpportunityDiscoveryService(repository, new OpportunityDiscoveryProviderRegistry([provider()]))
    const result = await service.run()
    expect(result).toMatchObject({ discovered: 1, persisted: 1, rejected: 0, opportunityIds: ['oce:test:1'] })
    expect((await repository.get('oce:test:1'))?.status).toBe('ready')
  })

  it('rejects records whose source identity does not match the provider', async () => {
    const repository = new InMemoryOpportunityRepository()
    const service = new OpportunityDiscoveryService(repository, [{ source, async discover() { return [{ opportunity: { ...opportunity(), sourceId: 'wrong-source' }, source }] } }])
    const result = await service.run()
    expect(result).toMatchObject({ discovered: 1, persisted: 0, rejected: 1 })
    expect(result.errors[0]).toContain('sourceId does not match')
  })
})
