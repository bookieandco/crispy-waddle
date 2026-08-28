import { describe, expect, it } from 'vitest'
import {
  createInMemoryGovernmentSourceRegistry,
  filterGovernmentSources,
  type GovernmentSource,
} from './source-registry'

const sources: GovernmentSource[] = [
  {
    id: 'us-sam',
    entityId: 'us',
    entity: {
      id: 'us',
      name: 'United States Federal Government',
      level: 'FEDERAL',
      geography: { countryCode: 'US', name: 'United States' },
    },
    kind: 'PROCUREMENT_PORTAL',
    portal: 'SAM_GOV',
    url: 'https://sam.gov/opportunities',
    official: true,
    active: true,
    capabilities: ['solicitations', 'amendments'],
    discoverySignals: ['solicitation'],
  },
  {
    id: 'tx-harris-bonfire',
    entityId: 'harris-county',
    entity: {
      id: 'harris-county',
      name: 'Harris County',
      level: 'COUNTY',
      geography: { countryCode: 'US', stateCode: 'TX', countyCode: '201', name: 'Harris County' },
    },
    kind: 'PROCUREMENT_PORTAL',
    portal: 'BONFIRE',
    url: 'https://harriscountytx.bonfirehub.com/',
    official: true,
    active: true,
    capabilities: ['solicitations', 'vendor_registration'],
    discoverySignals: ['bid', 'rfp'],
  },
]

describe('government source registry', () => {
  it('filters sources by geographic hierarchy', () => {
    expect(filterGovernmentSources(sources, { stateCode: 'TX' }).map((source) => source.id))
      .toEqual(['tx-harris-bonfire'])
    expect(filterGovernmentSources(sources, { level: 'FEDERAL' }).map((source) => source.id))
      .toEqual(['us-sam'])
  })

  it('filters by procurement portal and active state', () => {
    const registry = createInMemoryGovernmentSourceRegistry(sources)
    expect(registry.list({ portal: 'BONFIRE', active: true })).toHaveLength(1)
    expect(registry.list({ portal: 'SAM_GOV' })).toHaveLength(1)
  })

  it('upserts without creating duplicate source identities', () => {
    const registry = createInMemoryGovernmentSourceRegistry(sources)
    registry.upsert({ ...sources[1], capabilities: ['solicitations', 'rfp', 'contracts'] })
    expect(registry.list({ countyCode: '201' })).toHaveLength(1)
    expect(registry.list({ countyCode: '201' })[0]?.capabilities).toContain('contracts')
  })
})
