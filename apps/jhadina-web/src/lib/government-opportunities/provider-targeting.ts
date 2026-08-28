export type ProviderTargetReason =
  | 'INCUMBENT'
  | 'CAPABLE_PROVIDER'
  | 'SUBCONTRACTOR_CANDIDATE'
  | 'ACQUISITION_CANDIDATE'
  | 'PARTNER_CANDIDATE'

export type ProviderCompany = {
  id: string
  legalName: string
  jurisdiction: string
  companyNumber?: string
  website?: string
  industryCodes?: string[]
  governmentAwardIds?: string[]
}

export type OwnershipResearch = {
  companyId: string
  source: 'OFFICIAL_REGISTRY' | 'OPENCORPORATES' | 'OTHER_PUBLIC_SOURCE'
  officerNames?: string[]
  controllingEntity?: string
  ultimateBeneficialOwners?: string[]
  sourceUrl?: string
  evidenceIds: string[]
  confidence: number
}

export type ProviderTarget = {
  provider: ProviderCompany
  reasons: ProviderTargetReason[]
  ownershipResearch?: OwnershipResearch
  targetType: 'PARTNER' | 'SUBCONTRACTOR' | 'ACQUISITION' | 'INCUMBENT_OUTREACH'
}

/**
 * Identifies public-record ownership research as a business-development input.
 * It does not perform or authorize private-person data enrichment, and it does
 * not infer ownership when a public source does not establish it.
 */
export function buildProviderTarget(
  provider: ProviderCompany,
  reasons: ProviderTargetReason[],
  ownershipResearch?: OwnershipResearch,
): ProviderTarget {
  const acquisition = reasons.includes('ACQUISITION_CANDIDATE')
  const subcontractor = reasons.includes('SUBCONTRACTOR_CANDIDATE')
  const incumbent = reasons.includes('INCUMBENT')

  return {
    provider,
    reasons: [...new Set(reasons)],
    ownershipResearch,
    targetType: acquisition
      ? 'ACQUISITION'
      : subcontractor
        ? 'SUBCONTRACTOR'
        : incumbent
          ? 'INCUMBENT_OUTREACH'
          : 'PARTNER',
  }
}

export function rankProviderTargets(targets: ProviderTarget[]): ProviderTarget[] {
  const score = (target: ProviderTarget) => {
    const reasons = new Set(target.reasons)
    return (reasons.has('ACQUISITION_CANDIDATE') ? 4 : 0)
      + (reasons.has('INCUMBENT') ? 3 : 0)
      + (reasons.has('SUBCONTRACTOR_CANDIDATE') ? 2 : 0)
      + (reasons.has('CAPABLE_PROVIDER') ? 1 : 0)
  }

  return [...targets].sort((a, b) => score(b) - score(a))
}
