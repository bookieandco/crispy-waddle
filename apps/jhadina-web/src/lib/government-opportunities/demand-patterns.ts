export type DemandPattern =
  | 'RECURRING'
  | 'MANDATED'
  | 'URGENT'
  | 'EQUIPMENT_DEPENDENT'
  | 'STAFFING_SHORTAGE'
  | 'PUBLICLY_FUNDED'
  | 'SUBCONTRACTABLE'
  | 'FRAGMENTED_SUPPLY'

export type DemandSignal = {
  pattern: DemandPattern
  strength: number
  evidenceIds: string[]
  reason: string
}

export type DemandPatternInput = {
  opportunityId: string
  frequency?: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'RECURRING_OTHER'
  mandated?: boolean
  emergency?: boolean
  equipmentRequired?: boolean
  staffingShortage?: boolean
  publiclyFunded?: boolean
  subcontractAvailable?: boolean
  providerCount?: number
  evidence: Partial<Record<DemandPattern, string[]>>
}

export type DemandPatternAssessment = {
  opportunityId: string
  patterns: DemandSignal[]
  patternCount: number
  recurringScore: number
  opportunityShape: 'RECURRING' | 'URGENT' | 'STRUCTURAL' | 'PROJECT' | 'UNKNOWN'
}

function signal(pattern: DemandPattern, strength: number, evidenceIds: string[], reason: string): DemandSignal {
  return { pattern, strength: Math.max(0, Math.min(1, strength)), evidenceIds, reason }
}

/** Evidence-backed classification only. Missing facts remain unknown rather than inferred. */
export function assessDemandPatterns(input: DemandPatternInput): DemandPatternAssessment {
  const patterns: DemandSignal[] = []
  const evidence = input.evidence
  if (input.frequency && input.frequency !== 'ONE_TIME') {
    patterns.push(signal('RECURRING', 1, evidence.RECURRING ?? [], `${input.frequency.toLowerCase()} demand observed`))
  }
  if (input.mandated) patterns.push(signal('MANDATED', 1, evidence.MANDATED ?? [], 'requirement is identified as mandated'))
  if (input.emergency) patterns.push(signal('URGENT', 1, evidence.URGENT ?? [], 'urgent or emergency demand is identified'))
  if (input.equipmentRequired) patterns.push(signal('EQUIPMENT_DEPENDENT', 0.9, evidence.EQUIPMENT_DEPENDENT ?? [], 'specialized equipment is required'))
  if (input.staffingShortage) patterns.push(signal('STAFFING_SHORTAGE', 0.9, evidence.STAFFING_SHORTAGE ?? [], 'staffing constraint is identified'))
  if (input.publiclyFunded) patterns.push(signal('PUBLICLY_FUNDED', 0.9, evidence.PUBLICLY_FUNDED ?? [], 'public funding/reimbursement is identified'))
  if (input.subcontractAvailable) patterns.push(signal('SUBCONTRACTABLE', 0.9, evidence.SUBCONTRACTABLE ?? [], 'subcontract path is identified'))
  if (input.providerCount !== undefined && input.providerCount >= 0 && input.providerCount <= 5) {
    patterns.push(signal('FRAGMENTED_SUPPLY', 0.7, evidence.FRAGMENTED_SUPPLY ?? [], 'few providers are observed in the market'))
  }

  const recurring = patterns.find((item) => item.pattern === 'RECURRING')?.strength ?? 0
  const opportunityShape =
    recurring > 0 ? 'RECURRING' :
    patterns.some((item) => item.pattern === 'URGENT') ? 'URGENT' :
    patterns.some((item) => ['MANDATED', 'PUBLICLY_FUNDED', 'STAFFING_SHORTAGE'].includes(item.pattern)) ? 'STRUCTURAL' :
    patterns.length > 0 ? 'PROJECT' : 'UNKNOWN'

  return {
    opportunityId: input.opportunityId,
    patterns: patterns.sort((a, b) => b.strength - a.strength),
    patternCount: patterns.length,
    recurringScore: recurring,
    opportunityShape,
  }
}
