export type SharkKnowledgeUseFeedback = Readonly<{
  knowledgeKey: string
  previousWeight: number
  nextWeight: number
  effectivenessDelta: number
  sampleCount: number
  bounded: true
}>

export function applySharkKnowledgeUseFeedback(input: {
  knowledgeKey: string
  previousWeight: number
  effectivenessDelta: number
  sampleCount: number
  learningRate?: number
  minWeight?: number
  maxWeight?: number
}): SharkKnowledgeUseFeedback {
  if (!input.knowledgeKey.trim()) throw new Error('knowledge key is required')
  if (!Number.isFinite(input.previousWeight) || !Number.isFinite(input.effectivenessDelta)) throw new Error('weights and effectiveness must be finite')
  if (!Number.isFinite(input.sampleCount) || input.sampleCount < 1 || !Number.isInteger(input.sampleCount)) throw new Error('sample count must be a positive integer')
  const learningRate = input.learningRate ?? 0.1
  const minWeight = input.minWeight ?? 0
  const maxWeight = input.maxWeight ?? 1
  if (!Number.isFinite(learningRate) || learningRate < 0 || learningRate > 1) throw new Error('learning rate must be between 0 and 1')
  if (!Number.isFinite(minWeight) || !Number.isFinite(maxWeight) || minWeight > maxWeight) throw new Error('invalid weight bounds')
  const nextWeight = Math.min(maxWeight, Math.max(minWeight, input.previousWeight + (learningRate * input.effectivenessDelta) / Math.sqrt(input.sampleCount)))
  return Object.freeze({ knowledgeKey: input.knowledgeKey, previousWeight: input.previousWeight, nextWeight, effectivenessDelta: input.effectivenessDelta, sampleCount: input.sampleCount, bounded: true as const })
}
