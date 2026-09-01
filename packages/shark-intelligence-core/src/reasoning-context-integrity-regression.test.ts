import { assembleSharkContextAwareRetrieval } from './context-aware-retrieval-assembly'

describe('SHARK 1.49-C reasoning-context integrity regression', () => {
  it('preserves support, contradiction, rank, and contextual weight through assembly', () => {
    const context = assembleSharkContextAwareRetrieval({
      ranked: [
        { experienceId: 'e-support', score: 0.91, rank: 1, contextualWeight: 0.95 },
        { experienceId: 'e-conflict', score: 0.61, rank: 2, contextualWeight: 0.55 },
      ],
      contradictoryExperienceIds: ['e-conflict'],
    })

    expect(context.candidates).toEqual([
      { experienceId: 'e-support', score: 0.91, rank: 1, contextualWeight: 0.95, role: 'supporting' },
      { experienceId: 'e-conflict', score: 0.61, rank: 2, contextualWeight: 0.55, role: 'contradictory' },
    ])
    expect(context.supportingExperienceIds).toEqual(['e-support'])
    expect(context.contradictoryExperienceIds).toEqual(['e-conflict'])
  })

  it('does not let a stronger supporting candidate erase contradictory evidence', () => {
    const context = assembleSharkContextAwareRetrieval({
      ranked: [
        { experienceId: 'e1', score: 1, rank: 1, contextualWeight: 1 },
        { experienceId: 'e2', score: 0.01, rank: 2, contextualWeight: 0.01 },
      ],
      contradictoryExperienceIds: ['e2'],
    })
    expect(context.candidates.map(c => c.experienceId)).toEqual(['e1', 'e2'])
  })

  it('is deterministic and immutable at the reasoning-context boundary', () => {
    const input = { ranked: [{ experienceId: 'e1', score: 0.7, rank: 1, contextualWeight: 0.8 }] }
    const a = assembleSharkContextAwareRetrieval(input)
    const b = assembleSharkContextAwareRetrieval(input)
    expect(a).toEqual(b)
    expect(Object.isFrozen(a)).toBe(true)
    expect(Object.isFrozen(a.candidates)).toBe(true)
  })
})
