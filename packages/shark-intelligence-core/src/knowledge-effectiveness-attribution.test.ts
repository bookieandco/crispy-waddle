import { attributeSharkKnowledgeEffectiveness } from './knowledge-effectiveness-attribution'

describe('SHARK 1.47-B knowledge effectiveness attribution', () => {
  it('attributes an outcome delta to the knowledge used', () => {
    const result = attributeSharkKnowledgeEffectiveness({
      evaluationId: 'eval-1', outcomeScore: 0.8, baselineScore: 0.5,
      experienceIds: ['e1', 'e1'], beliefIds: ['b1'], proposalIds: ['p1'],
    })
    expect(result.delta).toBeCloseTo(0.3)
    expect(result.experienceIds).toEqual(['e1'])
    expect(result.beliefIds).toEqual(['b1'])
    expect(result.proposalIds).toEqual(['p1'])
    expect(result.attributed).toBe(true)
  })

  it('records negative effectiveness without rewriting knowledge', () => {
    const result = attributeSharkKnowledgeEffectiveness({
      evaluationId: 'eval-2', outcomeScore: 0.2, baselineScore: 0.7,
      experienceIds: ['e2'], beliefIds: ['b2'], proposalIds: ['p2'],
    })
    expect(result.delta).toBeCloseTo(-0.5)
    expect(result.experienceIds).toEqual(['e2'])
  })

  it('requires a knowledge reference and valid scores', () => {
    expect(() => attributeSharkKnowledgeEffectiveness({ evaluationId: 'e', outcomeScore: 0.5, baselineScore: 0.5, experienceIds: [], beliefIds: [], proposalIds: [] })).toThrow()
    expect(() => attributeSharkKnowledgeEffectiveness({ evaluationId: 'e', outcomeScore: 1.2, baselineScore: 0.5, experienceIds: ['e1'], beliefIds: [], proposalIds: [] })).toThrow()
  })
})
