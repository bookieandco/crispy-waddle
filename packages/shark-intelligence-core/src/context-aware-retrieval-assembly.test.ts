import { assembleSharkBeliefAwareContext, assembleSharkContextAwareRetrieval } from './context-aware-retrieval-assembly'

describe('SHARK 1.49-B context-aware retrieval assembly', () => {
  const ranked = [
    { experienceId: 'e1', score: 0.9, rank: 1, contextualWeight: 0.95 },
    { experienceId: 'e2', score: 0.7, rank: 2, contextualWeight: 0.7 },
    { experienceId: 'e3', score: 0.5, rank: 3, contextualWeight: 0.4 },
  ]

  it('assembles ranked candidates without losing ranking metadata', () => {
    const context = assembleSharkContextAwareRetrieval({ ranked })
    expect(context.candidates.map(c => c.experienceId)).toEqual(['e1', 'e2', 'e3'])
    expect(context.candidates[0].rank).toBe(1)
    expect(context.candidates[0].contextualWeight).toBe(0.95)
  })

  it('keeps contradictory candidates in the assembled context', () => {
    const context = assembleSharkContextAwareRetrieval({ ranked, contradictoryExperienceIds: ['e3'] })
    expect(context.supportingExperienceIds).toEqual(['e1', 'e2'])
    expect(context.contradictoryExperienceIds).toEqual(['e3'])
    expect(context.candidates).toHaveLength(3)
  })

  it('produces an immutable deterministic context', () => {
    const a = assembleSharkContextAwareRetrieval({ ranked })
    const b = assembleSharkContextAwareRetrieval({ ranked })
    expect(a).toEqual(b)
    expect(Object.isFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.candidates)).toBe(true)
  })
})

const reconciliation = {
  beliefId: 'b1', selectedVersion: 3, currentConfidence: 0.8, historicalAverageConfidence: 0.6,
  supportWeight: 2, conflictWeight: 1, netEvidence: 1, evidenceBalance: 1 / 3, direction: 'reinforced' as const,
  supportingExperienceIds: ['e1'], conflictingExperienceIds: ['e3'], historicalVersionIds: ['b1:v1', 'b1:v2', 'b1:v3'],
}
const candidate = (experienceId: string, relevance: number, confidence = 0.8) => ({
  experienceId, occurredAt: '2026-08-01', scenarioId: `s-${experienceId}`, strategyId: 'strategy-1', outcomeScore: 1,
  confidence, provenanceComplete: true, weight: 0.8, relevance, recency: 0.8, outcomeQuality: 1, relationshipStrength: 0.8,
})

describe('SHARK 1.52-B belief-aware contextual recall assembly', () => {
  it('wires belief feedback into ranking and preserves contradictions', () => {
    const context = assembleSharkBeliefAwareContext({
      reconciliation,
      candidates: [candidate('e1', 0.8), candidate('e2', 0.7), candidate('e3', 0.1)],
      maxCandidates: 2,
      minimumContradictions: 1,
      generatedAt: '2026-08-29T12:00:00.000Z',
    })
    expect(context.candidates).toHaveLength(2)
    expect(context.contradictoryExperienceIds).toContain('e3')
    expect(context.beliefFeedback?.beliefVersion).toBe(3)
  })

  it('never removes contradictory evidence when it is available', () => {
    const context = assembleSharkBeliefAwareContext({
      reconciliation,
      candidates: [candidate('e1', 0.9), candidate('e3', 0.2)],
      maxCandidates: 1,
      minimumContradictions: 1,
      generatedAt: '2026-08-29T12:00:00.000Z',
    })
    expect(context.candidates.map(c => c.experienceId)).toEqual(['e3'])
    expect(context.candidates[0].role).toBe('contradictory')
  })
})
