import { applySharkKnowledgeUseFeedback } from './knowledge-use-feedback'

describe('SHARK 1.47-C knowledge-use feedback loop', () => {
  it('raises weighting after positive effectiveness', () => {
    const result = applySharkKnowledgeUseFeedback({ knowledgeKey: 'k1', previousWeight: 0.5, effectivenessDelta: 0.4, sampleCount: 1 })
    expect(result.nextWeight).toBeGreaterThan(0.5)
  })

  it('lowers weighting after negative effectiveness', () => {
    const result = applySharkKnowledgeUseFeedback({ knowledgeKey: 'k1', previousWeight: 0.5, effectivenessDelta: -0.4, sampleCount: 1 })
    expect(result.nextWeight).toBeLessThan(0.5)
  })

  it('reduces the impact of repeated feedback as sample count grows', () => {
    const one = applySharkKnowledgeUseFeedback({ knowledgeKey: 'k1', previousWeight: 0.5, effectivenessDelta: 0.4, sampleCount: 1 })
    const many = applySharkKnowledgeUseFeedback({ knowledgeKey: 'k1', previousWeight: 0.5, effectivenessDelta: 0.4, sampleCount: 100 })
    expect(many.nextWeight - 0.5).toBeLessThan(one.nextWeight - 0.5)
  })

  it('bounds runaway weighting and validates inputs', () => {
    const result = applySharkKnowledgeUseFeedback({ knowledgeKey: 'k1', previousWeight: 0.99, effectivenessDelta: 10, sampleCount: 1 })
    expect(result.nextWeight).toBeLessThanOrEqual(1)
    expect(() => applySharkKnowledgeUseFeedback({ knowledgeKey: '', previousWeight: 0.5, effectivenessDelta: 0.1, sampleCount: 1 })).toThrow()
    expect(() => applySharkKnowledgeUseFeedback({ knowledgeKey: 'k1', previousWeight: 0.5, effectivenessDelta: 0.1, sampleCount: 0 })).toThrow()
  })

  it('preserves the feedback event as a separate weighting update', () => {
    const result = applySharkKnowledgeUseFeedback({ knowledgeKey: 'experience:e1', previousWeight: 0.5, effectivenessDelta: 0, sampleCount: 2 })
    expect(result.effectivenessDelta).toBe(0)
    expect(result.bounded).toBe(true)
    expect(result.nextWeight).toBe(0.5)
  })
})
