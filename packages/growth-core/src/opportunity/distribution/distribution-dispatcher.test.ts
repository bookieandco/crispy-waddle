import { describe, expect, it } from 'vitest'
import { DistributionProviderRegistry, type DistributionProviderAdapter } from './provider-adapter.js'
import { createDistributionJob } from './distribution-job.js'
import { dispatchDistributionJobToProvider } from './distribution-dispatcher.js'

const job = createDistributionJob({ id: 'job-1', idempotencyKey: 'opp-1:v1:tiktok', targetId: 'v1:tiktok', opportunityId: 'opp-1', variantId: 'v1', measurementId: 'opp-1:v1:tiktok', channel: 'tiktok', maxAttempts: 2 })

describe('Distribution dispatcher', () => {
  it('resolves the normalized channel and records the provider result', async () => {
    const registry = new DistributionProviderRegistry()
    const adapter: DistributionProviderAdapter = { channel: 'tiktok', publish: async request => ({ status: 'published', externalPostId: 'post-1', canonicalUrl: 'https://example.test/post-1', measurementId: request.measurementId }) }
    registry.register(adapter)
    const result = await dispatchDistributionJobToProvider(job, 'approved content', registry, '2026-08-28T00:00:00Z')
    expect(result).toMatchObject({ status: 'published', attempts: 1, providerPostId: 'post-1', canonicalUrl: 'https://example.test/post-1' })
  })

  it('fails closed when no provider is registered', async () => {
    await expect(dispatchDistributionJobToProvider(job, 'content', new DistributionProviderRegistry())).rejects.toThrow('distribution_provider_not_registered')
  })
})
