import { describe, expect, it, vi } from 'vitest'
import { DistributionProviderRegistry } from './provider-adapter.js'
import { GatewayDistributionProviderAdapter, registerSocialProviderAdapters } from './social-provider-adapters.js'

describe('social provider adapters', () => {
  it('routes through a provider gateway without embedding credentials in growth-core', async () => {
    const publish = vi.fn(async request => ({ status: 'published' as const, externalPostId: 'ig-1', measurementId: request.measurementId }))
    const adapter = new GatewayDistributionProviderAdapter('instagram', { publish })
    const result = await adapter.publish({ targetId: 'v1:instagram', opportunityId: 'opp-1', variantId: 'v1', channel: 'instagram', content: 'hello', measurementId: 'opp-1:v1:instagram' })
    expect(result.externalPostId).toBe('ig-1')
    expect(publish).toHaveBeenCalledOnce()
  })

  it('registers only configured channels', () => {
    const registry = new DistributionProviderRegistry()
    registerSocialProviderAdapters({ instagram: { publish: async request => ({ status: 'published', measurementId: request.measurementId }) } }, registry)
    expect(registry.get('instagram')).toBeDefined()
    expect(registry.get('tiktok')).toBeUndefined()
  })
})
