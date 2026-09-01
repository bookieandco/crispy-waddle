import { rankSharkContextualRecall } from './contextual-recall-ranking'

describe('SHARK contextual recall ranking', () => {
  const candidate = (id: string, relevance: number, confidence: number, recency: number, relationshipStrength: number, contradictionPenalty = 0, contextualWeight?: number) => ({
    experienceId: id, occurredAt: '2026-08-01', scenarioId: `s-${id}`, strategyId: 'strategy-1', outcomeScore: 1,
    confidence, provenanceComplete: true, weight: 0.8, relevance, recency, outcomeQuality: 1,
    relationshipStrength, contradictionPenalty, contextualWeight,
  })

  it('uses contextual weight in the actual retrieval ranking', () => {
    const result = rankSharkContextualRecall({ candidates: [
      candidate('global-strong', 0.9, 0.9, 0.9, 0.9, 0, 0.2),
      candidate('contextually-relevant', 0.7, 0.7, 0.7, 0.7, 0, 0.95),
    ] })
    expect(result[0].experienceId).toBe('contextually-relevant')
    expect(result[0].contextualWeight).toBe(0.95)
  })

  it('defaults missing contextual weight to neutral 1 for backward compatibility', () => {
    const result = rankSharkContextualRecall({ candidates: [candidate('legacy', 0.8, 0.8, 0.8, 0.8)] })
    expect(result[0].contextualWeight).toBe(1)
  })

  it('keeps contradictory candidates available while lowering their rank', () => {
    const result = rankSharkContextualRecall({ candidates: [candidate('support', 0.8, 0.8, 0.8, 0.8, 0, 0.9), candidate('contradiction', 0.8, 0.8, 0.8, 0.8, 1, 0.9)] })
    expect(result.map(r => r.experienceId)).toEqual(['support', 'contradiction'])
    expect(result[1].score).toBeLessThan(result[0].score)
  })

  it('uses deterministic ordering and validates contextual bounds', () => {
    const result = rankSharkContextualRecall({ candidates: [candidate('b', 0.8, 0.8, 0.8, 0.8, 0, 0.5), candidate('a', 0.8, 0.8, 0.8, 0.8, 0, 0.5)], limit: 1 })
    expect(result).toHaveLength(1)
    expect(result[0].experienceId).toBe('a')
    expect(() => rankSharkContextualRecall({ candidates: [candidate('bad', 0.8, 0.8, 0.8, 0.8, 0, 1.1)] })).toThrow()
  })
})
