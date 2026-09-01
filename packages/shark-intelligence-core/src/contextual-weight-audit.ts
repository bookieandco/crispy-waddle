export type SharkContextualWeightAudit = Readonly<{
  eventId: string
  knowledgeKey: string
  contextualWeight: number
  baseWeight: number
  contextSimilarity: number
  effectiveness: number
  beliefRelevance: number
  evidenceQuality: number
  occurredAt: string
}>

export function createSharkContextualWeightAudit(input: Omit<SharkContextualWeightAudit, 'eventId' | 'occurredAt'> & { eventId: string; occurredAt: string }): SharkContextualWeightAudit {
  if (!input.eventId.trim() || !input.knowledgeKey.trim() || !input.occurredAt.trim()) throw new Error('audit identity, knowledge key, and timestamp are required')
  const values = [input.contextualWeight, input.baseWeight, input.contextSimilarity, input.effectiveness, input.beliefRelevance, input.evidenceQuality]
  if (values.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new Error('contextual weight signals must be between 0 and 1')
  return Object.freeze({ ...input })
}
