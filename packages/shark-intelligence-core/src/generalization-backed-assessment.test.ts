import { assessWithSharkGeneralization } from './generalization-backed-assessment'

describe('SHARK 1.39 generalization-backed assessment', () => {
  const knowledge = [{ knowledgeId: 'k1', strategyId: 's1', stage: 'usable_for_assessment' as const, scenarioTags: ['normal'], confidence: 0.9, sampleSize: 1000, provenanceComplete: true, relevanceScore: 0.9, usable: true }]
  const training = Array.from({ length: 5 }, (_, i) => ({ scenarioId: `t-${i}`, strategyId: 's1', regime: 'normal', volatility: 0.2 + i * 0.01, liquidity: 0.8, spread: 0.1, instrument: 'paper-equity', horizon: 'intraday' }))

  it('keeps a well-supported candidate knowledge-backed', () => {
    const result = assessWithSharkGeneralization({ assessmentId: 'a1', opportunityId: 'o1', strategyId: 's1', knowledge, trainingScenarios: training, candidateScenario: { ...training[0], scenarioId: 'candidate' } })
    expect(result.status).toBe('KNOWLEDGE_BACKED')
    expect(result.generalization.status).toBe('GENERALIZED')
  })

  it('downgrades an out-of-distribution candidate to uncertainty', () => {
    const result = assessWithSharkGeneralization({ assessmentId: 'a2', opportunityId: 'o2', strategyId: 's1', knowledge, trainingScenarios: training, candidateScenario: { scenarioId: 'stress', strategyId: 's1', regime: 'crisis', volatility: 1, liquidity: 0.01, spread: 1, instrument: 'paper-equity', horizon: 'swing' } })
    expect(result.status).toBe('ASSESSMENT_WITH_UNCERTAINTY')
    expect(result.uncertainty).toBeGreaterThan(0.5)
  })

  it('preserves insufficient-knowledge as a hard failure', () => {
    const result = assessWithSharkGeneralization({ assessmentId: 'a3', opportunityId: 'o3', strategyId: 's2', knowledge, trainingScenarios: training, candidateScenario: training[0] })
    expect(result.status).toBe('INSUFFICIENT_KNOWLEDGE')
  })
})
