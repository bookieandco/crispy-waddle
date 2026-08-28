import { describe, expect, it } from 'vitest'
import { DistributionProviderRegistry, type DistributionProviderAdapter } from './provider-adapter.js'

describe('Distribution provider registry', () => {
  it('registers adapters by normalized channel', () => {
    const adapter: DistributionProviderAdapter = { channel: 'tiktok', publish: async request => ({ status: 'published', externalPostId: 'post-1', measurementId: request.measurementId }) }
    const registry = new DistributionProviderRegistry()
    registry.register(adapter)
    expect(registry.get('tiktok')).toBe(adapter)
    expect(registry.get('instagram')).toBeUndefined()
  })
})
