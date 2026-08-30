export type SharkLongitudinalEvaluation = Readonly<{
  evaluationId: string
  baselineScore: number
  currentScore: number
  improvement: number
  improved: boolean
  evaluationCount: number
}>

export function evaluateSharkLongitudinalKnowledge(input: {
  evaluationId: string
  baselineScore: number
  currentScore: number
  evaluationCount: number
}): SharkLongitudinalEvaluation {
  if (!input.evaluationId.trim()) throw new Error('evaluation ID is required')
  for (const score of [input.baselineScore, input.currentScore]) {
    if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error('scores must be between 0 and 1')
  }
  if (!Number.isInteger(input.evaluationCount) || input.evaluationCount < 1) throw new Error('evaluation count must be positive')
  const improvement = input.currentScore - input.baselineScore
  return Object.freeze({
    evaluationId: input.evaluationId,
    baselineScore: input.baselineScore,
    currentScore: input.currentScore,
    improvement,
    improved: improvement > 0,
    evaluationCount: input.evaluationCount,
  })
}
