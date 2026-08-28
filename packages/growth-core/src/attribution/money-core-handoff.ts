import type { OpportunityPerformanceSignal } from './opportunity-performance-signal.js'

export const OPPORTUNITY_PERFORMANCE_RECORDED = 'growth.opportunity.performance_recorded'

export type MoneyCoreOpportunityPerformance = {
  eventType: typeof OPPORTUNITY_PERFORMANCE_RECORDED
  eventId: string
  occurredAt: string
  opportunityId: string
  realizedRevenue: number
  realizedProfit: number
  realizedProfitPerHour?: number
  conversionCount: number
  confidence: OpportunityPerformanceSignal['confidence']
  currency: string
  source: 'growth-attribution'
}

export interface MoneyCorePerformanceSink {
  recordPerformance(event: MoneyCoreOpportunityPerformance): Promise<void>
}

export function toMoneyCorePerformanceEvent(
  signal: OpportunityPerformanceSignal,
  currency = 'USD',
  occurredAt = new Date().toISOString(),
): MoneyCoreOpportunityPerformance {
  return {
    eventType: OPPORTUNITY_PERFORMANCE_RECORDED,
    eventId: `opportunity-performance:${signal.opportunityId}`,
    occurredAt,
    opportunityId: signal.opportunityId,
    realizedRevenue: signal.realizedRevenue,
    realizedProfit: signal.realizedProfit,
    realizedProfitPerHour: signal.realizedProfitPerHour,
    conversionCount: signal.conversionCount,
    confidence: signal.confidence,
    currency,
    source: 'growth-attribution',
  }
}

export class IdempotentMoneyCorePerformanceSink implements MoneyCorePerformanceSink {
  private readonly recorded = new Set<string>()

  constructor(private readonly sink: MoneyCorePerformanceSink) {}

  async recordPerformance(event: MoneyCoreOpportunityPerformance): Promise<void> {
    if (this.recorded.has(event.eventId)) return
    await this.sink.recordPerformance(event)
    this.recorded.add(event.eventId)
  }
}
