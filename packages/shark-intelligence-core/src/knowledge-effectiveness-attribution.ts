export type SharkKnowledgeEffectivenessAttribution = Readonly<{
  evaluationId: string
  outcomeScore: number
  baselineScore: number
  delta: number
  experienceIds: readonly string[]
  beliefIds: readonly string[]
  proposalIds: readonly string[]
  attributed: true
}>

export function attributeSharkKnowledgeEffectiveness(input: {
  evaluationId: string
  outcomeScore: number
  baselineScore: number
  experienceIds: string[]
  beliefIds: string[]
  proposalIds: string[]
}): SharkKnowledgeEffectivenessAttribution {
  if (!input.evaluationId.trim()) throw new Error('evaluation ID is required')
  for (const score of [input.outcomeScore, input.baselineScore]) {
    if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error('scores must be between 0 and 1')
  }
  if (!input.experienceIds.length && !input.beliefIds.length && !input.proposalIds.length) {
    throw new Error('attribution requires at least one knowledge reference')
  }
  return Object.freeze({
    evaluationId: input.evaluationId,
    outcomeScore: input.outcomeScore,
    baselineScore: input.baselineScore,
    delta: input.outcomeScore - input.baselineScore,
    experienceIds: Object.freeze([...new Set(input.experienceIds)]),
    beliefIds: Object.freeze([...new Set(input.beliefIds)]),
    proposalIds: Object.freeze([...new Set(input.proposalIds)]),
    attributed: true as const,
  })
}
