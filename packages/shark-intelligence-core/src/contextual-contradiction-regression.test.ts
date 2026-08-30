import { calculateSharkContextualWeight } from './contextual-weight'

describe('SHARK 1.48-D cross-context contradiction protection', () => {
  const common = { baseWeight: 0.9, effectiveness: 0.9, beliefRelevance: 0.8, evidenceQuality: 0.9 }

  it('allows both supporting and conflicting knowledge to be scored independently', () => {
    const support = calculateSharkContextualWeight({ ...common, knowledgeKey: 'support:e1', contextSimilarity: 0.95 })
    const conflict = calculateSharkContextualWeight({ ...common, knowledgeKey: 'conflict:e2', contextSimilarity: 0.9 })
    expect(support.contextualWeight).toBeGreaterThan(0)
    expect(conflict.contextualWeight).toBeGreaterThan(0)
  })

  it('does not turn contextual priority into truth', () => {
    const favored = calculateSharkContextualWeight({ ...common, knowledgeKey: 'support:e1', contextSimilarity: 1 })
    const contradictory = calculateSharkContextualWeight({ ...common, knowledgeKey: 'conflict:e2', contextSimilarity: 0.6 })
    expect(favored.contextualWeight).toBeGreaterThan(contradictory.contextualWeight)
    expect(contradictory.contextualWeight).toBeGreaterThan(0)
  })

  it('keeps unrelated context from deleting knowledge', () => {
    const result = calculateSharkContextualWeight({ ...common, knowledgeKey: 'conflict:e2', contextSimilarity: 0.01 })
    expect(result.contextualWeight).toBeGreaterThanOrEqual(0)
    expect(result.knowledgeKey).toBe('conflict:e2')
  })

  it('remains bounded when all signals are maximal', () => {
    const result = calculateSharkContextualWeight({ knowledgeKey: 'k', baseWeight: 1, contextSimilarity: 1, effectiveness: 1, beliefRelevance: 1, evidenceQuality: 1 })
    expect(result.contextualWeight).toBe(1)
  })
})
