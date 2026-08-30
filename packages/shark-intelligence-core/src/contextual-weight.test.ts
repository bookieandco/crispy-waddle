import { calculateSharkContextualWeight } from './contextual-weight'

describe('SHARK 1.48-B contextual weighting', () => {
  const base = { knowledgeKey: 'experience:e1', baseWeight: 0.8, effectiveness: 0.9, beliefRelevance: 0.7, evidenceQuality: 1 }

  it('raises relevance for stronger contextual similarity', () => {
    const low = calculateSharkContextualWeight({ ...base, contextSimilarity: 0.2 })
    const high = calculateSharkContextualWeight({ ...base, contextSimilarity: 0.9 })
    expect(high.contextualWeight).toBeGreaterThan(low.contextualWeight)
  })

  it('does not treat low contextual relevance as falsehood', () => {
    const result = calculateSharkContextualWeight({ ...base, contextSimilarity: 0.1 })
    expect(result.contextualWeight).toBeGreaterThanOrEqual(0)
    expect(result.evidenceQuality).toBe(1)
  })

  it('combines independent signals deterministically and remains bounded', () => {
    const result = calculateSharkContextualWeight({ ...base, contextSimilarity: 0.5 })
    expect(result.contextualWeight).toBeCloseTo(0.252)
    expect(result.contextualWeight).toBeGreaterThanOrEqual(0)
    expect(result.contextualWeight).toBeLessThanOrEqual(1)
  })

  it('rejects invalid keys and signal values', () => {
    expect(() => calculateSharkContextualWeight({ ...base, knowledgeKey: '' })).toThrow()
    expect(() => calculateSharkContextualWeight({ ...base, contextSimilarity: 1.1 })).toThrow()
  })
})
