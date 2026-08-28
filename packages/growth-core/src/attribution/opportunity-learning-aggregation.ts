import type { OpportunityLearningDelta } from './opportunity-learning-evaluator.js'

export type OpportunityLearningAggregate = {
  key: string
  sampleCount: number
  alignedCount: number
  overestimatedCount: number
  underestimatedCount: number
  measurableCount: number
  averageScoreError?: number
  averageRealizedProfit: number
  averageRealizedRevenue: number
}

export function aggregateOpportunityLearning(
  records: OpportunityLearningDelta[],
  keyOf: (record: OpportunityLearningDelta) => string,
): OpportunityLearningAggregate[] {
  const groups = new Map<string, OpportunityLearningAggregate & { scoreErrorTotal: number }>()
  for (const record of records) {
    const key = keyOf(record)
    const current = groups.get(key) ?? {
      key, sampleCount: 0, alignedCount: 0, overestimatedCount: 0,
      underestimatedCount: 0, measurableCount: 0, scoreErrorTotal: 0,
      averageRealizedProfit: 0, averageRealizedRevenue: 0,
    }
    current.sampleCount += 1
    current.averageRealizedProfit += record.realizedProfit
    current.averageRealizedRevenue += record.realizedRevenue
    if (record.scoreError !== undefined) {
      current.measurableCount += 1
      current.scoreErrorTotal += record.scoreError
    }
    if (record.predictionDirection === 'aligned') current.alignedCount += 1
    if (record.predictionDirection === 'overestimated') current.overestimatedCount += 1
    if (record.predictionDirection === 'underestimated') current.underestimatedCount += 1
    groups.set(key, current)
  }
  return [...groups.values()].map(({ scoreErrorTotal, ...group }) => ({
    ...group,
    averageScoreError: group.measurableCount > 0 ? scoreErrorTotal / group.measurableCount : undefined,
    averageRealizedProfit: group.sampleCount > 0 ? group.averageRealizedProfit / group.sampleCount : 0,
    averageRealizedRevenue: group.sampleCount > 0 ? group.averageRealizedRevenue / group.sampleCount : 0,
  }))
}
