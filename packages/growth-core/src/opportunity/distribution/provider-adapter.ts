import type { SocialChannel } from '../creative/social-bridge.js'

export type DistributionProviderRequest = {
  targetId: string
  opportunityId: string
  variantId: string
  channel: SocialChannel
  content: string
  scheduledFor?: string
  measurementId: string
}

export type DistributionProviderResult = {
  status: 'scheduled' | 'published' | 'failed'
  externalPostId?: string
  canonicalUrl?: string
  publishedAt?: string
  measurementId: string
}

export interface DistributionProviderAdapter {
  readonly channel: SocialChannel
  publish(request: DistributionProviderRequest): Promise<DistributionProviderResult>
}

export class DistributionProviderRegistry {
  private readonly adapters = new Map<SocialChannel, DistributionProviderAdapter>()

  register(adapter: DistributionProviderAdapter): void {
    this.adapters.set(adapter.channel, adapter)
  }

  get(channel: SocialChannel): DistributionProviderAdapter | undefined {
    return this.adapters.get(channel)
  }
}
