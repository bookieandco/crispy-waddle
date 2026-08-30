import { assembleContradictionAwareSharkContext } from './contradiction-aware-context'

describe('SHARK 1.44-D contradiction-aware context', () => {
  const candidate = (id: string, relationshipStrength = 0.8) => ({
    experienceId: id, occurredAt: '2026-08-01', scenarioId: `s-${id}`, strategyId: 's1', outcomeScore: 1,
    confidence: 0.9, provenanceComplete: true, weight: 0.8, relevance: 0.9, recency: 0.8, outcomeQuality: 1,
    relationshipStrength,
  })

  it('separates supporting and conflicting evidence', () => {
    const result = assembleContradictionAwareSharkContext({
      candidates: [candidate('e1'), candidate('e2')],
      conflictingExperienceIds: ['e2'],
    })
    expect(result.supportingExperienceIds).toEqual(['e1'])
    expect(result.conflictingExperienceIds).toEqual(['e2'])
  })

  it('computes a signed evidence balance instead of deleting contradictions', () => {
    const result = assembleContradictionAwareSharkContext({
      candidates: [candidate('support'), candidate('conflict')],
      conflictingExperienceIds: ['conflict'],
    })
    expect(result.supportingScores.support).toBeGreaterThan(0)
    expect(result.conflictingScores.conflict).toBeGreaterThan(0)
    expect(result.balance).toBeCloseTo(0)
  })

  it('preserves all candidate IDs in their appropriate evidence set', () => {
    const result = assembleContradictionAwareSharkContext({
      candidates: [candidate('e1'), candidate('e2'), candidate('e3')],
      conflictingExperienceIds: ['e2'],
    })
    expect([...result.supportingExperienceIds, ...result.conflictingExperienceIds].sort()).toEqual(['e1', 'e2', 'e3'])
  })
})
