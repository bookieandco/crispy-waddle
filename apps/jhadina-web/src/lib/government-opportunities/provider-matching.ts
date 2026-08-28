export type ProviderCapability = {
  category: string
  serviceArea: string
  licensed?: boolean
  licenseEvidenceId?: string
}

export type ProviderCandidate = {
  id: string
  name: string
  geography: string
  capabilities: ProviderCapability[]
  insuranceVerified?: boolean
  complianceVerified?: boolean
  evidenceIds: string[]
}

export type ProviderMatchInput = {
  provider: ProviderCandidate
  requiredCategory: string
  requiredGeography: string
  requireLicense?: boolean
  requireInsurance?: boolean
}

export type ProviderMatch = {
  providerId: string
  score: number
  eligibleSignals: string[]
  missingSignals: string[]
  evidenceIds: string[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Scores potential fulfillment partners without asserting legal eligibility.
 * Actual licensing, insurance and compliance verification remain evidence gates.
 */
export function matchProvider(input: ProviderMatchInput): ProviderMatch {
  const provider = input.provider
  const capability = provider.capabilities.find(
    (item) => item.category.toLowerCase() === input.requiredCategory.toLowerCase(),
  )
  const geographyMatch = provider.geography.toLowerCase() === input.requiredGeography.toLowerCase()
  const licensed = capability?.licensed === true
  const insurance = provider.insuranceVerified === true
  const compliance = provider.complianceVerified === true

  const eligibleSignals: string[] = []
  const missingSignals: string[] = []
  if (capability) eligibleSignals.push('required service capability')
  else missingSignals.push('required service capability')
  if (geographyMatch) eligibleSignals.push('required geography')
  else missingSignals.push('required geography')
  if (input.requireLicense ? licensed : capability?.licenseEvidenceId) eligibleSignals.push('license evidence')
  else if (input.requireLicense) missingSignals.push('license verification')
  if (input.requireInsurance ? insurance : insurance) eligibleSignals.push('insurance evidence')
  else if (input.requireInsurance) missingSignals.push('insurance verification')
  if (compliance) eligibleSignals.push('compliance evidence')

  const score = clamp(
    (capability ? 35 : 0) +
      (geographyMatch ? 25 : 0) +
      (licensed ? 15 : 0) +
      (insurance ? 10 : 0) +
      (compliance ? 15 : 0),
  )

  return {
    providerId: provider.id,
    score,
    eligibleSignals,
    missingSignals,
    evidenceIds: [...provider.evidenceIds],
  }
}

export function rankProviders(inputs: ProviderMatchInput[]): ProviderMatch[] {
  return inputs.map(matchProvider).sort((a, b) => b.score - a.score)
}
