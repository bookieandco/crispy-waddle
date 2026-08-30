import type { SharkBeliefUpdate } from './belief-update'

export type SharkBeliefUpdateAuditEvent = Readonly<{
  eventId: string
  eventType: 'BELIEF_UPDATED'
  occurredAt: string
  beliefId: string
  updateId: string
  proposalId: string
  previousConfidence: number
  newConfidence: number
  supportingExperienceIds: readonly string[]
  conflictingExperienceIds: readonly string[]
  validation: { validated: true }
}>

export function createSharkBeliefUpdateAuditEvent(input: {
  eventId: string
  occurredAt: string
  update: SharkBeliefUpdate
}): SharkBeliefUpdateAuditEvent {
  if (!input.eventId.trim() || !input.occurredAt.trim()) throw new Error('audit event identity and timestamp are required')
  if (input.update.validated !== true) throw new Error('audit events require a validated belief update')
  return Object.freeze({
    eventId: input.eventId,
    eventType: 'BELIEF_UPDATED' as const,
    occurredAt: input.occurredAt,
    beliefId: input.update.beliefId,
    updateId: input.update.updateId,
    proposalId: input.update.proposalId,
    previousConfidence: input.update.previousConfidence,
    newConfidence: input.update.newConfidence,
    supportingExperienceIds: Object.freeze([...input.update.supportingExperienceIds]),
    conflictingExperienceIds: Object.freeze([...input.update.conflictingExperienceIds]),
    validation: Object.freeze({ validated: true as const }),
  })
}
