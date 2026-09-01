import type { SharkLongitudinalBeliefReconciliation } from './longitudinal-belief-reconciliation'

export type SharkBeliefReconciliationAudit = Readonly<{
  auditId: string
  beliefId: string
  selectedVersion: number
  historicalVersionIds: readonly string[]
  supportingExperienceIds: readonly string[]
  conflictingExperienceIds: readonly string[]
  supportWeight: number
  conflictWeight: number
  netEvidence: number
  evidenceBalance: number
  currentConfidence: number
  historicalAverageConfidence: number
  direction: 'reinforced' | 'weakened' | 'stable'
  occurredAt: string
}>

export function createSharkBeliefReconciliationAudit(input: {
  auditId: string
  reconciliation: SharkLongitudinalBeliefReconciliation
  occurredAt: string
}): SharkBeliefReconciliationAudit {
  if (!input.auditId.trim() || !input.occurredAt.trim()) throw new Error('audit identity and timestamp are required')
  const r = input.reconciliation
  if (!Number.isFinite(r.currentConfidence) || r.currentConfidence < 0 || r.currentConfidence > 1) throw new Error('current confidence must be between 0 and 1')
  if (!Number.isFinite(r.historicalAverageConfidence) || r.historicalAverageConfidence < 0 || r.historicalAverageConfidence > 1) throw new Error('historical confidence must be between 0 and 1')
  if (!Number.isFinite(r.supportWeight) || r.supportWeight < 0 || !Number.isFinite(r.conflictWeight) || r.conflictWeight < 0) throw new Error('evidence weights must be non-negative')
  return Object.freeze({
    auditId: input.auditId,
    beliefId: r.beliefId,
    selectedVersion: r.selectedVersion,
    historicalVersionIds: Object.freeze([...r.historicalVersionIds]),
    supportingExperienceIds: Object.freeze([...r.supportingExperienceIds]),
    conflictingExperienceIds: Object.freeze([...r.conflictingExperienceIds]),
    supportWeight: r.supportWeight,
    conflictWeight: r.conflictWeight,
    netEvidence: r.netEvidence,
    evidenceBalance: r.evidenceBalance,
    currentConfidence: r.currentConfidence,
    historicalAverageConfidence: r.historicalAverageConfidence,
    direction: r.direction,
    occurredAt: input.occurredAt,
  })
}
