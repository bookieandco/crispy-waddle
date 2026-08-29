export type SharkScenario = {
  scenarioId: string
  strategyId: string
  regime: string
  volatility: number
  liquidity: number
  spread: number
  instrument: string
  horizon: string
}

export type SharkGeneralizationResult = {
  status: 'GENERALIZED' | 'OUT_OF_DISTRIBUTION' | 'INSUFFICIENT_GENERALIZATION'
  similarityScore: number
  trainingScenarioCount: number
  matchedScenarioCount: number
  reasons: string[]
  simulated: true
  paperOnly: true
}

export function evaluateSharkScenarioGeneralization(input: {
  trainingScenarios: SharkScenario[]
  candidate: SharkScenario
  minimumTrainingScenarios?: number
  minimumSimilarity?: number
}): SharkGeneralizationResult {
  const minimumTrainingScenarios = input.minimumTrainingScenarios ?? 5
  const minimumSimilarity = input.minimumSimilarity ?? 0.6
  if (input.trainingScenarios.length < minimumTrainingScenarios) return {
    status: 'INSUFFICIENT_GENERALIZATION', similarityScore: 0,
    trainingScenarioCount: input.trainingScenarios.length, matchedScenarioCount: 0,
    reasons: ['insufficient training scenario diversity'], simulated: true, paperOnly: true,
  }

  const compatible = input.trainingScenarios.filter(s => s.strategyId === input.candidate.strategyId && s.instrument === input.candidate.instrument)
  if (compatible.length === 0) return {
    status: 'OUT_OF_DISTRIBUTION', similarityScore: 0,
    trainingScenarioCount: input.trainingScenarios.length, matchedScenarioCount: 0,
    reasons: ['no compatible training scenarios'], simulated: true, paperOnly: true,
  }

  const similarity = (s: SharkScenario) => {
    const numericSimilarity = 1 - Math.min(1, (Math.abs(s.volatility - input.candidate.volatility) + Math.abs(s.liquidity - input.candidate.liquidity) + Math.abs(s.spread - input.candidate.spread)) / 3)
    const categoricalSimilarity = (s.regime === input.candidate.regime ? 0.25 : 0) + (s.horizon === input.candidate.horizon ? 0.25 : 0)
    return Math.min(1, numericSimilarity * 0.5 + categoricalSimilarity)
  }
  const scores = compatible.map(similarity)
  const similarityScore = Math.max(...scores)
  const matchedScenarioCount = scores.filter(score => score >= minimumSimilarity).length
  const status = similarityScore >= minimumSimilarity ? 'GENERALIZED' : 'OUT_OF_DISTRIBUTION'
  const reasons = status === 'GENERALIZED' ? [] : ['candidate scenario falls below similarity threshold']
  return { status, similarityScore, trainingScenarioCount: input.trainingScenarios.length, matchedScenarioCount, reasons, simulated: true, paperOnly: true }
}
