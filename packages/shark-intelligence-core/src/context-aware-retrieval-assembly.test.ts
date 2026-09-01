import { assembleSharkContextAwareRetrieval } from './context-aware-retrieval-assembly'

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
