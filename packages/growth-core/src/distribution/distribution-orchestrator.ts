import type {
  DistributionChannelAdapter,
  DistributionIntent,
  DistributionResult,
} from './distribution-intent.js'

export type DistributionBatchResult = {
  results: DistributionResult[]
}

export class DistributionOrchestrator {
  private readonly adapters: Map<DistributionChannelAdapter['channel'], DistributionChannelAdapter>

  constructor(adapters: DistributionChannelAdapter[]) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.channel, adapter]))
  }

  async dispatch(intents: DistributionIntent[]): Promise<DistributionBatchResult> {
    const results = await Promise.all(intents.map(async (intent) => {
      const adapter = this.adapters.get(intent.channel)
      if (!adapter) {
        return {
          intentId: intent.intentId,
          channel: intent.channel,
          status: 'failed' as const,
          errorCode: 'distribution_channel_adapter_unavailable',
        }
      }
      try {
        return await adapter.publish(intent)
      } catch {
        return {
          intentId: intent.intentId,
          channel: intent.channel,
          status: 'failed' as const,
          errorCode: 'distribution_adapter_error',
        }
      }
    }))

    return { results }
  }
}
