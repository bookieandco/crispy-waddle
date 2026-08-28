import type { DistributionChannel, DistributionChannelAdapter } from './distribution-intent.js'

export class DistributionChannelAdapterRegistry {
  private readonly adapters = new Map<DistributionChannel, DistributionChannelAdapter>()

  register(adapter: DistributionChannelAdapter): void {
    if (this.adapters.has(adapter.channel)) {
      throw new Error(`distribution_channel_adapter_already_registered:${adapter.channel}`)
    }
    this.adapters.set(adapter.channel, adapter)
  }

  get(channel: DistributionChannel): DistributionChannelAdapter | undefined {
    return this.adapters.get(channel)
  }

  has(channel: DistributionChannel): boolean {
    return this.adapters.has(channel)
  }

  listChannels(): DistributionChannel[] {
    return [...this.adapters.keys()]
  }

  createAdapterList(): DistributionChannelAdapter[] {
    return [...this.adapters.values()]
  }
}
