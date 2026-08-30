import { applySharkKnowledgeUseFeedback } from './knowledge-use-feedback'

describe('SHARK 1.47-D feedback-loop stability regression', () => {
  it('keeps repeated positive feedback bounded', () => {
    let weight = 0.5
    for (let i = 1; i <= 1000; i++) {
      weight = applySharkKnowledgeUseFeedback({ knowledgeKey: 'k', previousWeight: weight, effectivenessDelta: 1, sampleCount: i }).nextWeight
    }
    expect(weight).toBeLessThanOrEqual(1)
    expect(weight).toBeGreaterThan(0.5)
  })

  it('keeps repeated negative feedback bounded', () => {
    let weight = 0.5
    for (let i = 1; i <= 1000; i++) {
      weight = applySharkKnowledgeUseFeedback({ knowledgeKey: 'k', previousWeight: weight, effectivenessDelta: -1, sampleCount: i }).nextWeight
    }
    expect(weight).toBeGreaterThanOrEqual(0)
    expect(weight).toBeLessThan(0.5)
  })

  it('does not oscillate when effectiveness is neutral', () => {
    let weight = 0.62
    for (let i = 1; i <= 100; i++) {
      weight = applySharkKnowledgeUseFeedback({ knowledgeKey: 'k', previousWeight: weight, effectivenessDelta: 0, sampleCount: i }).nextWeight
    }
    expect(weight).toBe(0.62)
  })

  it('never makes a weight leave its configured bounds', () => {
    const high = applySharkKnowledgeUseFeedback({ knowledgeKey: 'k', previousWeight: 0.95, effectivenessDelta: 100, sampleCount: 1, minWeight: 0.2, maxWeight: 0.8 })
    const low = applySharkKnowledgeUseFeedback({ knowledgeKey: 'k', previousWeight: 0.25, effectivenessDelta: -100, sampleCount: 1, minWeight: 0.2, maxWeight: 0.8 })
    expect(high.nextWeight).toBe(0.8)
    expect(low.nextWeight).toBe(0.2)
  })
})
