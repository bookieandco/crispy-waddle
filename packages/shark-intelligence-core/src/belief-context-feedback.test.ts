import { applySharkBeliefContextFeedback } from './belief-context-feedback'

const reconciliation = {
  beliefId: 'b1',
  selectedVersion: 3,
  currentConfidence: 0.8,
  historicalAverageConfidence: 0.6,
  supportWeight: 2,
  conflictWeight: 1,
  netEvidence: 1,
  evidenceBalance: 1 / 3,
  direction: 'reinforced' as const,
  supportingExperienceIds: ['e1'],
  conflictingExperienceIds: ['e2'],
  historicalVersionIds: ['b1:v1', 'b1:v2', 'b1:v3'],
}

const candidate = (experienceId: string, contextualWeight = 0) => ({
  experienceId,
  occurredAt: '2026-08-01',
  scenarioId: `s-${experienceId}`,
  strategyId: 'strategy-1',
  outcomeScore: 1,
  confidence: 0.8,
  provenanceComplete: true,
  weight: 0.8,
  relevance: 0.8,
  recency: 0.8,
  outcomeQuality: 1,
  relationshipStrength: 0.8,
  contextualWeight,
})

describe('SHARK 1.52-A belief-to-context feedback', () => {
  it('feeds reconciled belief state into contextual weighting without filtering candidates', () => {
    const result = applySharkBeliefContextFeedback({
      reconciliation,
      candidates: [candidate('e1'), candidate('e2'), candidate('e3')],
      generatedAt: '2026-08-29T12:00:00.000Z',
    })

    expect(result.frame.beliefVersion).toBe(3)
    expect(result.candidates.map(c => c.experienceId)).toEqual(['e1', 'e2', 'e3'])
    expect(result.candidates.find(c => c.experienceId === 'e1')?.contextualWeight).toBeGreaterThan(0)
    expect(result.candidates.find(c => c.experienceId === 'e2')?.contextualWeight).toBeGreaterThan(0)
  })

  it('never suppresses contradictory evidence', () => {
    const result = applySharkBeliefContextFeedback({
      reconciliation,
      candidates: [candidate('e2')],
      maxInfluence: 0.2,
    })

    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].experienceId).toBe('e2')
    expect(result.candidates[0].contextualWeight).toBeGreaterThan(0)
  })

  it('does not erase evidence when influence is zero', () => {
    const result = applySharkBeliefContextFeedback({
      reconciliation,
      candidates: [candidate('e1', 0.4), candidate('e2', 0.3)],
      maxInfluence: 0,
    })

    expect(result.candidates[0].contextualWeight).toBe(0.4)
    expect(result.candidates[1].contextualWeight).toBe(0.3)
  })

  it('rejects a stale belief version from overwriting newer context', () => {
    expect(() => applySharkBeliefContextFeedback({
      reconciliation,
      candidates: [candidate('e1')],
      context: {
        contextId: 'ctx-1',
        version: 4,
        parentContextId: 'ctx-0',
        experienceIds: ['e1'],
        beliefVersionIds: ['b1:v4'],
        unresolvedContradictionIds: ['c1'],
        updatedAt: '2026-08-29T11:00:00.000Z',
      },
    })).toThrow('stale belief version cannot overwrite newer context')
  })

  it('produces a deterministic immutable frame for fixed inputs', () => {
    const input = {
      reconciliation,
      candidates: [candidate('e1'), candidate('e2')],
      generatedAt: '2026-08-29T12:00:00.000Z',
    }
    const first = applySharkBeliefContextFeedback(input)
    const second = applySharkBeliefContextFeedback(input)

    expect(first).toEqual(second)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.frame)).toBe(true)
    expect(Object.isFrozen(first.candidates)).toBe(true)
    expect(Object.isFrozen(first.candidates[0])).toBe(true)
  })
})
