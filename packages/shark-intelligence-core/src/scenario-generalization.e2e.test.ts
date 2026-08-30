import { assessWithSharkGeneralization } from './generalization-backed-assessment'

describe('SHARK 1.39 final generalization boundary', () => {
  const knowledge = [{ knowledgeId: 'k1', strategyId: 's1', stage: 'usable_for_assessment' as const, scenarioTags: ['normal'], confidence: 0.9, sampleSize: 1000, provenanceComplete: true, relevanceScore: 0.9, usable: true }]
  const training = Array.from({ length: 5 }, (_, i) => ({ scenarioId: `t-${i}`, strategyId: 's1', regime: 'normal', volatility: 0.2 + i * 0.01, liquidity: 0.8, spread: 0.1, instrument: 'paper-equity', horizon: 'intraday' }))

  it('passes a supported nearby scenario', () => {
    const r = assessWithSharkGeneralization({ assessmentId: 'final-1', opportunityId: 'o1', strategyId: 's1', knowledge, trainingScenarios: training, candidateScenario: { ...training[0], scenarioId: 'candidate' } })
    expect(r.status).toBe('KNOWLEDGE_BACKED')
    expect(r.generalization.status).toBe('GENERALIZED')
  })

  it('downgrades a stress regime rather than claiming transfer', () => {
    const r = assessWithSharkGeneralization({ assessmentId: 'final-2', opportunityId: 'o2', strategyId: 's1', knowledge, trainingScenarios: training, candidateScenario: { scenarioId: 'stress', strategyId: 's1', regime: 'crisis', volatility: 1, liquidity: 0.01, spread: 1, instrument: 'paper-equity', horizon: 'swing' } })
    expect(r.status).toBe('ASSESSMENT_WITH_UNCERTAINTY')
    expect(r.uncertainty).toBeGreaterThan(0.5)
  })

  it('fails closed when training coverage is too small', () => {
    const r = assessWithSharkGeneralization({ assessmentId: 'final-3', opportunityId: 'o3', strategyId: 's1', knowledge, trainingScenarios: training.slice(0, 4), candidateScenario: training[0] })
    expect(r.status).toBe('ASSESSMENT_WITH_UNCERTAINTY')
    expect(r.generalization.status).toBe('INSUFFICIENT_GENERALIZATION')
    expect(r.uncertainty).toBeGreaterThan(0.5)
  })

  it('preserves hard knowledge failures', () => {
    const r = assessWithSharkGeneralization({ assessmentId: 'final-4', opportunityId: 'o4', strategyId: 's2', knowledge, trainingScenarios: training, candidateScenario: training[0] })
    expect(r.status).toBe('INSUFFICIENT_KNOWLEDGE')
    expect(r.simulated).toBe(true)
    expect(r.paperOnly).toBe(true)
  })
})
