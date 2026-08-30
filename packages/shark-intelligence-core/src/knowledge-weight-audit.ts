export type SharkKnowledgeWeightAudit = Readonly<{
  eventId: string
  knowledgeKey: string
  previousWeight: number
  nextWeight: number
  effectivenessDelta: number
  sampleCount: number
  reason: 'positive-effectiveness' | 'negative-effectiveness' | 'neutral-effectiveness'
  occurredAt: string
}>

export function createSharkKnowledgeWeightAudit(input: {
  eventId: string
  knowledgeKey: string
  previousWeight: number
  nextWeight: number
  effectivenessDelta: number
  sampleCount: number
  occurredAt: string
}): SharkKnowledgeWeightAudit {
  if (!input.eventId.trim() || !input.knowledgeKey.trim() || !input.occurredAt.trim()) throw new Error('audit identity, knowledge key, and timestamp are required')
  for (const weight of [input.previousWeight, input.nextWeight]) {
    if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('weights must be between 0 and 1')
  }
  if (!Number.isFinite(input.effectivenessDelta) || !Number.isFinite(input.sampleCount) || input.sampleCount < 1 || !Number.isInteger(input.sampleCount)) throw new Error('invalid feedback metadata')
  const reason = input.effectivenessDelta > 0 ? 'positive-effectiveness' : input.effectivenessDelta < 0 ? 'negative-effectiveness' : 'neutral-effectiveness'
  return Object.freeze({
    eventId: input.eventId,
    knowledgeKey: input.knowledgeKey,
    previousWeight: input.previousWeight,
    nextWeight: input.nextWeight,
    effectivenessDelta: input.effectivenessDelta,
    sampleCount: input.sampleCount,
    reason,
    occurredAt: input.occurredAt,
  })
}
