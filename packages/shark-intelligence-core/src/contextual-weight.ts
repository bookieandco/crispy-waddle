export type SharkContextualWeight = Readonly<{
  knowledgeKey: string
  baseWeight: number
  contextSimilarity: number
  effectiveness: number
  beliefRelevance: number
  evidenceQuality: number
  contextualWeight: number
}>

export function calculateSharkContextualWeight(input: {
  knowledgeKey: string
  baseWeight: number
  contextSimilarity: number
  effectiveness: number
  beliefRelevance: number
  evidenceQuality: number
}): SharkContextualWeight {
  const values = [input.baseWeight, input.contextSimilarity, input.effectiveness, input.beliefRelevance, input.evidenceQuality]
  if (!input.knowledgeKey.trim()) throw new Error('knowledge key is required')
  if (values.some(value => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error('all weighting signals must be between 0 and 1')
  const contextualWeight = Math.min(1, Math.max(0, input.baseWeight * input.contextSimilarity * input.effectiveness * input.beliefRelevance * input.evidenceQuality))
  return Object.freeze({ ...input, contextualWeight })
}
