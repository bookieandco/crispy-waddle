import { rankSharkContextualRecall } from './contextual-recall-ranking'

describe('SHARK 1.44-B contextual recall ranking', () => {
  const candidate = (id: string, relevance: number, confidence: number, recency: number, relationshipStrength: number, contradictionPenalty = 0) => ({
    experienceId: id, occurredAt: '2026-08-01', scenarioId: `s-${id}`, strategyId: 'strategy-1', outcomeScore: 1,
    confidence, provenanceComplete: true, weight: 0.8, relevance, recency, outcomeQuality: 1,
    relationshipStrength, contradictionPenalty,
  })

  it('ranks by combined relevance, confidence, recency, and relationship strength', () => {
    const result = rankSharkContextualRecall({ candidates: [candidate('low', 0.4, 0.5, 0.5, 0.4), candidate('high', 0.9, 0.9, 0.8, 0.9)] })
    expect(result[0].experienceId).toBe('high')
    expect(result[0].rank).toBe(1)
  })

  it('penalizes contradictory context without deleting the candidate', () => {
    const result = rankSharkContextualRecall({ candidates: [candidate('support', 0.8, 0.8, 0.8, 0.8), candidate('contradiction', 0.8, 0.8, 0.8, 0.8, 1)] })
    expect(result.map(r => r.experienceId)).toEqual(['support', 'contradiction'])
    expect(result[1].score).toBeLessThan(result[0].score)
  })

  it('uses deterministic tie-breaking and enforces limits', () => {
    const result = rankSharkContextualRecall({ candidates: [candidate('b', 0.8, 0.8, 0.8, 0.8), candidate('a', 0.8, 0.8, 0.8, 0.8)], limit: 1 })
    expect(result).toHaveLength(1)
    expect(result[0].experienceId).toBe('a')
  })

  it('rejects invalid ranking parameters', () => {
    expect(() => rankSharkContextualRecall({ candidates: [candidate('bad', 0.8, 0.8, 0.8, 1.1)] })).toThrow()
    expect(() => rankSharkContextualRecall({ candidates: [candidate('bad', 0.8, 0.8, 0.8, 0.8, -0.1)] })).toThrow()
    expect(() => rankSharkContextualRecall({ candidates: [], limit: -1 })).toThrow()
  })
})
