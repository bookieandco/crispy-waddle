export interface VerifiedPrincipalForEnrichment {
  principalId: string
  corporateEntityId: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  sourceId: string
  evidenceId: string
}

export interface BusinessContactEnrichmentResult {
  providerId: string
  principalId: string
  businessEmails: string[]
  businessPhones: string[]
  businessWebsites: string[]
  evidenceIds: string[]
  observedAt: string
}

export interface BusinessContactEnrichmentProvider {
  providerId: string
  enrich(input: VerifiedPrincipalForEnrichment): Promise<BusinessContactEnrichmentResult>
}

export interface EnrichmentEscalationPolicy {
  minimumConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  allowedProviderIds: string[]
}

const confidenceRank: Record<VerifiedPrincipalForEnrichment['confidence'], number> = { LOW: 1, MEDIUM: 2, HIGH: 3 }

export function canEscalatePrincipalEnrichment(principal: VerifiedPrincipalForEnrichment, policy: EnrichmentEscalationPolicy, providerId: string): boolean {
  if (!principal.principalId || !principal.corporateEntityId || !principal.sourceId || !principal.evidenceId) return false
  if (!policy.allowedProviderIds.includes(providerId)) return false
  return confidenceRank[principal.confidence] >= confidenceRank[policy.minimumConfidence]
}

export async function escalateBusinessContactEnrichment(principal: VerifiedPrincipalForEnrichment, policy: EnrichmentEscalationPolicy, provider: BusinessContactEnrichmentProvider): Promise<BusinessContactEnrichmentResult | null> {
  if (!canEscalatePrincipalEnrichment(principal, policy, provider.providerId)) return null
  return provider.enrich(principal)
}
