import { rankSharkContextualRecall } from './contextual-recall-ranking'
import { synthesizeSharkContext } from './contextual-recall-synthesis'
import { assembleContradictionAwareSharkContext } from './contradiction-aware-context'

describe('SHARK 1.44-E final contextual recall regression', () => {
  const candidate = (id: string, relevance: number, confidence: number, recency: number, relationshipStrength: number, contradictionPenalty = 0) => ({
    experienceId: id, occurredAt: '2026-08-01', scenarioId: `s-${id}`, strategyId: 'strategy-1', outcomeScore: 1,
    confidence, provenanceComplete: true, weight: 0.8, relevance, recency, outcomeQuality: 1,
    relationshipStrength, contradictionPenalty,
  })

  it('keeps strong supporting and conflicting evidence available for reasoning', () => {
    const candidates = [candidate('support-1', 0.95, 0.9, 0.8, 0.9), candidate('support-2', 0.8, 0.85, 0.7, 0.8), candidate('conflict-1', 0.9, 0.9, 0.8, 0.95)]
    const ranked = rankSharkContextualRecall({ candidates })
    const context = synthesizeSharkContext({ queryNodeId: 'current', ranked, nodes: [] })
    const balanced = assembleContradictionAwareSharkContext({ candidates, conflictingExperienceIds: ['conflict-1'] })
    expect(context.sourceExperienceIds).toHaveLength(3)
    expect(balanced.supportingExperienceIds).toEqual(['support-1', 'support-2'])
    expect(balanced.conflictingExperienceIds).toEqual(['conflict-1'])
    expect(balanced.conflictingScores['conflict-1']).toBeGreaterThan(0)
  })

  it('does not let contradictory evidence disappear merely because support ranks higher', () => {
    const candidates = [candidate('a', 1, 1, 1, 1), candidate('z', 0.95, 1, 1, 1)]
    const ranked = rankSharkContextualRecall({ candidates, limit: 2 })
    const context = synthesizeSharkContext({ queryNodeId: 'current', ranked, nodes: [], contradictionExperienceIds: ['z'] })
    expect(context.rankedExperienceIds).toEqual(['a', 'z'])
    expect(context.contradictionCount).toBe(1)
  })

  it('handles empty history without manufacturing knowledge', () => {
    const context = synthesizeSharkContext({ queryNodeId: 'current', ranked: [], nodes: [] })
    expect(context.sourceExperienceIds).toEqual([])
    expect(context.confidence).toBe(0)
    expect(context.contradictionCount).toBe(0)
  })
})
