export type OwnershipSource = 'STATE_REGISTRY' | 'OPENCORPORATES' | 'CONTRACT_RECORD' | 'COMPANY_WEBSITE' | 'OTHER_PUBLIC_RECORD'

export type OwnershipRecord = {
  companyId: string
  personOrEntityId: string
  relationship: 'OWNER' | 'OFFICER' | 'CONTROL_PERSON' | 'PARENT_ENTITY'
  source: OwnershipSource
  sourceReference: string
  confidence: number
  evidenceIds: string[]
  observedAt?: string
}

export type AcquisitionTargetInput = {
  companyId: string
  incumbentCount: number
  recurringContractCount: number
  targetJurisdictionMatch: boolean
  ownershipRecords: OwnershipRecord[]
  estimatedOpportunityValue?: number
  providerMatchScore?: number
}

export type AcquisitionTargetAssessment = {
  companyId: string
  acquisitionScore: number
  ownerIds: string[]
  verifiedOwnershipCount: number
  rationale: string[]
  evidenceIds: string[]
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

/**
 * Public-record ownership intelligence for business-development and acquisition
 * research. It does not perform private-person skip tracing or infer ownership
 * from weak identity matches. Downstream review is required before outreach or
 * transaction activity.
 */
export function assessAcquisitionTarget(input: AcquisitionTargetInput): AcquisitionTargetAssessment {
  const verified = input.ownershipRecords.filter((record) => record.confidence >= 0.8)
  const ownerIds = [...new Set(verified.filter((record) => record.relationship === 'OWNER' || record.relationship === 'CONTROL_PERSON').map((record) => record.personOrEntityId))]
  const recurring = clamp(input.recurringContractCount / 10)
  const incumbency = clamp(input.incumbentCount / 10)
  const jurisdiction = input.targetJurisdictionMatch ? 1 : 0
  const providerMatch = clamp(input.providerMatchScore ?? 0)
  const ownership = verified.length > 0 ? 1 : 0

  const acquisitionScore = clamp(
    recurring * 0.25 +
      incumbency * 0.2 +
      jurisdiction * 0.15 +
      providerMatch * 0.2 +
      ownership * 0.2,
  )

  return {
    companyId: input.companyId,
    acquisitionScore,
    ownerIds,
    verifiedOwnershipCount: verified.length,
    rationale: [
      ...(recurring >= 0.5 ? ['recurring contract history increases acquisition value'] : []),
      ...(incumbency >= 0.5 ? ['incumbent position indicates established delivery capability'] : []),
      ...(jurisdiction ? ['target jurisdiction alignment is present'] : []),
      ...(providerMatch >= 0.7 ? ['provider-to-opportunity fit is strong'] : []),
      ...(ownership ? ['public-record ownership/control evidence is available'] : []),
    ],
    evidenceIds: [...new Set(input.ownershipRecords.flatMap((record) => record.evidenceIds))],
  }
}
