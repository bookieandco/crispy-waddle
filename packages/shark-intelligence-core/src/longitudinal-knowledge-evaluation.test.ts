import { evaluateSharkLongitudinalKnowledge } from './longitudinal-knowledge-evaluation'

describe('SHARK 1.47-A longitudinal knowledge evaluation', () => {
  it('detects improvement from baseline to current performance', () => {
    const result = evaluateSharkLongitudinalKnowledge({ evaluationId: 'eval-1', baselineScore: 0.5, currentScore: 0.8, evaluationCount: 10 })
    expect(result.improvement).toBeCloseTo(0.3)
    expect(result.improved).toBe(true)
  })

  it('does not call unchanged or degraded performance an improvement', () => {
    expect(evaluateSharkLongitudinalKnowledge({ evaluationId: 'eval-2', baselineScore: 0.8, currentScore: 0.8, evaluationCount: 2 }).improved).toBe(false)
    expect(evaluateSharkLongitudinalKnowledge({ evaluationId: 'eval-3', baselineScore: 0.8, currentScore: 0.4, evaluationCount: 2 }).improved).toBe(false)
  })

  it('requires valid evaluation inputs', () => {
    expect(() => evaluateSharkLongitudinalKnowledge({ evaluationId: ' ', baselineScore: 0.5, currentScore: 0.5, evaluationCount: 1 })).toThrow()
    expect(() => evaluateSharkLongitudinalKnowledge({ evaluationId: 'e', baselineScore: 1.1, currentScore: 0.5, evaluationCount: 1 })).toThrow()
    expect(() => evaluateSharkLongitudinalKnowledge({ evaluationId: 'e', baselineScore: 0.5, currentScore: 0.5, evaluationCount: 0 })).toThrow()
  })
})
