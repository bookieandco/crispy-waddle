import type { DistributionProviderAdapter, DistributionProviderRequest, DistributionProviderResult } from './provider-adapter.js'
import type { SocialChannel } from '../creative/social-bridge.js'

export type SocialPublishGateway = {
  publish(request: DistributionProviderRequest): Promise<DistributionProviderResult>
}

export class GatewayDistributionProviderAdapter implements DistributionProviderAdapter {
  constructor(public readonly channel: SocialChannel, private readonly gateway: SocialPublishGateway) {}

  publish(request: DistributionProviderRequest): Promise<DistributionProviderResult> {
    if (request.channel !== this.channel) throw new Error('distribution_channel_mismatch')
    return this.gateway.publish(request)
  }
}

export function registerSocialProviderAdapters(
  gateways: Partial<Record<SocialChannel, SocialPublishGateway>>,
  registry: { register(adapter: DistributionProviderAdapter): void },
): void {
  for (const [channel, gateway] of Object.entries(gateways) as [SocialChannel, SocialPublishGateway][]) {
    if (gateway) registry.register(new GatewayDistributionProviderAdapter(channel, gateway))
  }
}
