export type InformationBrokerNiche = 'small_business_funding' | 'real_estate_programs'

export type InformationBrokerSourceTier = 'federal' | 'state' | 'local'

export type InformationBrokerEvidenceRule = {
  requirePrimarySource: boolean
  allowSellerClaims: boolean
  claimConfidenceCap: number
  recheckDays: number
}

export type InformationBrokerBlueprint = {
  niche: InformationBrokerNiche
  sourceTiers: readonly InformationBrokerSourceTier[]
  discoverySignals: readonly string[]
  monetization: readonly ('lead_magnet' | 'membership' | 'research_service' | 'community')[]
  evidence: InformationBrokerEvidenceRule
}

export const INFORMATION_BROKER_BLUEPRINTS: readonly InformationBrokerBlueprint[] = [
  {
    niche: 'small_business_funding',
    sourceTiers: ['federal', 'state', 'local'],
    discoverySignals: [
      'micro_grant',
      'pitch_competition',
      'cdfi_program',
      'economic_development_program',
      'technical_assistance_voucher',
      'small_business_funding',
    ],
    monetization: ['lead_magnet', 'membership', 'research_service', 'community'],
    evidence: { requirePrimarySource: true, allowSellerClaims: true, claimConfidenceCap: 0.35, recheckDays: 7 },
  },
  {
    niche: 'real_estate_programs',
    sourceTiers: ['federal', 'state', 'local'],
    discoverySignals: [
      'down_payment_assistance',
      'tax_abatement',
      'opportunity_zone',
      'historic_preservation',
      'energy_incentive',
      'neighborhood_rehabilitation',
    ],
    monetization: ['lead_magnet', 'membership', 'research_service', 'community'],
    evidence: { requirePrimarySource: true, allowSellerClaims: true, claimConfidenceCap: 0.35, recheckDays: 7 },
  },
]

export const buildInformationBrokerEvidencePolicy = (blueprint: InformationBrokerBlueprint) => ({
  sourceRequirement: blueprint.evidence.requirePrimarySource ? 'primary_or_independently_verified' : 'any',
  sellerClaimConfidenceCap: blueprint.evidence.allowSellerClaims
    ? blueprint.evidence.claimConfidenceCap
    : 0,
  recheckAfterDays: blueprint.evidence.recheckDays,
})
