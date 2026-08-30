import { calculateSharkContextualWeight } from './contextual-weight'

describe('SHARK 1.48-C contextual-weight regression', () => {
  const signals = { knowledgeKey: 'k', baseWeight: 0.8, effectiveness: 0.9, beliefRelevance: 0.7, evidenceQuality: 0.8 }

  it('is deterministic across repeated evaluation', () => {
    const a = calculateSharkContextualWeight({ ...signals, contextSimilarity: 0.65 })
    const b = calculateSharkContextualWeight({ ...signals, contextSimilarity: 0.65 })
    expect(a.contextualWeight).toBe(b.contextualWeight)
  })

  it('never exceeds bounds at context extremes', () => {
    const low = calculateSharkContextualWeight({ ...signals, contextSimilarity: 0 })
    const high = calculateSharkContextualWeight({ ...signals, contextSimilarity: 1 })
    expect(low.contextualWeight).toBe(0)
    expect(high.contextualWeight).toBeLessThanOrEqual(1)
    expect(high.contextualWeight).toBeGreaterThan(low.contextualWeight)
  })

  it('keeps contextual relevance distinct from evidence quality', () => {
    const result = calculateSharkContextualWeight({ ...signals, contextSimilarity: 0.1, evidenceQuality: 1 })
    expect(result.contextSimilarity).toBe(0.1)
    expect(result.evidenceQuality).toBe(1)
  })

  it('does not allow a strong unrelated context signal to create an out-of-range weight', () => {
    const result = calculateSharkContextualWeight({ knowledgeKey: 'k', baseWeight: 1, contextSimilarity: 1, effectiveness: 1, beliefRelevance: 1, evidenceQuality: 1 })
    expect(result.contextualWeight).toBe(1)
  })
})
