import type { OpportunityRankingFeedback } from './opportunity-ranking-feedback.js'

export const OPPORTUNITY_PATTERN_SIGNAL = 'growth.opportunity.pattern_signal'

export type OpportunityPatternSignal = {
  eventType: typeof OPPORTUNITY_PATTERN_SIGNAL
  eventId: string
  occurredAt: string
  key: string
  adjustment: number
  sampleCount: number
  rationale: OpportunityRankingFeedback['rationale']
  source: 'opportunity-learning'
}

export interface PatternSignalSink {
  emit(signal: OpportunityPatternSignal): Promise<void>
}

export function toPatternEngineSignal(
  feedback: OpportunityRankingFeedback,
  occurredAt = new Date().toISOString(),
): OpportunityPatternSignal {
  return {
    eventType: OPPORTUNITY_PATTERN_SIGNAL,
    eventId: `opportunity-pattern:${feedback.key}`,
    occurredAt,
    key: feedback.key,
    adjustment: feedback.adjustment,
    sampleCount: feedback.sampleCount,
    rationale: feedback.rationale,
    source: 'opportunity-learning',
  }
}
