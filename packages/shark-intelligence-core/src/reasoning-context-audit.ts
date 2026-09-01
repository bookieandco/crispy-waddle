import type { SharkReasoningHandoff } from './knowledge-use-handoff'

export type SharkReasoningContextAudit = Readonly<{
  eventId: string
  queryNodeId: string
  includedExperienceIds: readonly string[]
  contradictionExperienceIds: readonly string[]
  excludedExperienceIds: readonly string[]
  contradictionQuota: number
  contradictionReserved: boolean
  evidenceBalance: number
  evidenceStrength: number
  historicalEvidencePreserved: true
  occurredAt: string
}>

export function createSharkReasoningContextAudit(input: {
  eventId: string
  handoff: SharkReasoningHandoff
  excludedExperienceIds?: readonly string[]
  contradictionQuota?: number
  contradictionReserved?: boolean
  occurredAt: string
}): SharkReasoningContextAudit {
  if (!input.eventId.trim() || !input.occurredAt.trim()) throw new Error('audit identity and timestamp are required')
  if (!Number.isFinite(input.handoff.evidenceBalance) || input.handoff.evidenceBalance < -1 || input.handoff.evidenceBalance > 1) throw new Error('evidence balance must be between -1 and 1')
  if (!Number.isFinite(input.handoff.evidenceStrength) || input.handoff.evidenceStrength < 0) throw new Error('evidence strength must be non-negative')
  const contradictionQuota = input.contradictionQuota ?? 0
  if (!Number.isInteger(contradictionQuota) || contradictionQuota < 0) throw new Error('contradiction quota must be a non-negative integer')
  return Object.freeze({
    eventId: input.eventId,
    queryNodeId: input.handoff.queryNodeId,
    includedExperienceIds: Object.freeze([...input.handoff.experienceIds]),
    contradictionExperienceIds: Object.freeze(input.handoff.experienceIds.filter(id => input.handoff.contradictionCount > 0 && id !== input.handoff.queryNodeId).slice(0, input.handoff.contradictionCount)),
    excludedExperienceIds: Object.freeze([...(input.excludedExperienceIds ?? [])]),
    contradictionQuota,
    contradictionReserved: input.contradictionReserved ?? false,
    evidenceBalance: input.handoff.evidenceBalance,
    evidenceStrength: input.handoff.evidenceStrength,
    historicalEvidencePreserved: true,
    occurredAt: input.occurredAt,
  })
}
