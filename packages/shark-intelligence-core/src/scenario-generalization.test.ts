import { evaluateSharkScenarioGeneralization } from './scenario-generalization'

describe('SHARK 1.39 scenario generalization', () => {
  const training = Array.from({ length: 5 }, (_, i) => ({
    scenarioId: `s-${i}`, strategyId: 'strat-1', regime: 'normal', volatility: 0.2 + i * 0.01,
    liquidity: 0.8, spread: 0.1, instrument: 'paper-equity', horizon: 'intraday',
  }))

  it('generalizes to a similar unseen scenario', () => {
    const result = evaluateSharkScenarioGeneralization({
      trainingScenarios: training,
      candidate: { scenarioId: 'new', strategyId: 'strat-1', regime: 'normal', volatility: 0.22, liquidity: 0.79, spread: 0.1, instrument: 'paper-equity', horizon: 'intraday' },
    })
    expect(result.status).toBe('GENERALIZED')
  })

  it('rejects an incompatible strategy or instrument', () => {
    const result = evaluateSharkScenarioGeneralization({
      trainingScenarios: training,
      candidate: { scenarioId: 'new', strategyId: 'strat-2', regime: 'normal', volatility: 0.2, liquidity: 0.8, spread: 0.1, instrument: 'paper-equity', horizon: 'intraday' },
    })
    expect(result.status).toBe('OUT_OF_DISTRIBUTION')
  })

  it('rejects insufficient training diversity', () => {
    const result = evaluateSharkScenarioGeneralization({ trainingScenarios: training.slice(0, 4), candidate: training[0] })
    expect(result.status).toBe('INSUFFICIENT_GENERALIZATION')
  })

  it('detects materially different market conditions', () => {
    const result = evaluateSharkScenarioGeneralization({
      trainingScenarios: training,
      candidate: { scenarioId: 'stress', strategyId: 'strat-1', regime: 'crisis', volatility: 1, liquidity: 0.01, spread: 1, instrument: 'paper-equity', horizon: 'swing' },
    })
    expect(result.status).toBe('OUT_OF_DISTRIBUTION')
  })
})
