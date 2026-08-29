export type EnrichmentProviderId =
  | 'OPENCORPORATES'
  | 'SEC_EDGAR'
  | 'SAM_GOV'
  | 'GLEIF'
  | 'STATE_REGISTRY'
  | (string & {})

export type EnrichmentDisposition =
  | 'ENRICHED'
  | 'PARTIAL'
  | 'NO_MATCH'
  | 'SKIPPED'
  | 'RATE_LIMITED'
  | 'FAILED'
  | 'REVIEW_REQUIRED'

export interface BusinessEnrichmentRequest {
  principalId: string
  corporateEntityId: string
  jurisdiction?: string
  allowedProviders?: EnrichmentProviderId[]
  minimumIdentityConfidence: number
  minimumRoleConfidence: number
  allowContactEnrichment?: boolean
}

export interface BusinessEnrichmentEvidence {
  evidenceId: string
  providerId: EnrichmentProviderId
  sourceRecordId?: string
  sourceUrl?: string
  sourceType?: string
  publisher?: string
  observedAt?: string
  retrievedAt?: string
  confidence?: number
}

export interface BusinessEnrichmentResult {
  providerId: EnrichmentProviderId
  disposition: Exclude<EnrichmentDisposition, 'SKIPPED'>
  evidence: BusinessEnrichmentEvidence[]
  fields: Record<string, string | number | boolean | null>
  reasons: string[]
}

export interface BusinessEnrichmentProvider {
  readonly id: EnrichmentProviderId
  enrich(request: BusinessEnrichmentRequest): Promise<BusinessEnrichmentResult>
}

export interface BusinessEnrichmentOutcome {
  principalId: string
  corporateEntityId: string
  disposition: EnrichmentDisposition
  providerResults: BusinessEnrichmentResult[]
  evidence: BusinessEnrichmentEvidence[]
  reasons: string[]
}

/**
 * Orchestrates independent business-record providers.
 *
 * This layer deliberately does not make provider-specific HTTP calls. Providers
 * own authentication, caching, rate limits, and source-specific normalization.
 * The orchestrator decides whether a principal is eligible and combines the
 * resulting evidence without treating any provider as authoritative.
 */
export async function enrichPrincipalFromProviders(
  request: BusinessEnrichmentRequest,
  providers: BusinessEnrichmentProvider[],
): Promise<BusinessEnrichmentOutcome> {
  if (request.minimumIdentityConfidence < 0 || request.minimumIdentityConfidence > 100) {
    throw new Error('minimumIdentityConfidence must be between 0 and 100')
  }

  if (request.minimumRoleConfidence < 0 || request.minimumRoleConfidence > 100) {
    throw new Error('minimumRoleConfidence must be between 0 and 100')
  }

  if (request.allowContactEnrichment) {
    throw new Error(
      'Contact enrichment requires the permitted-contact escalation boundary and is not enabled by the base business-record orchestrator',
    )
  }

  const selected = providers.filter(
    (provider) => !request.allowedProviders || request.allowedProviders.includes(provider.id),
  )

  if (selected.length === 0) {
    return {
      principalId: request.principalId,
      corporateEntityId: request.corporateEntityId,
      disposition: 'SKIPPED',
      providerResults: [],
      evidence: [],
      reasons: ['No eligible enrichment providers were selected'],
    }
  }

  const settled = await Promise.allSettled(selected.map((provider) => provider.enrich(request)))
  const providerResults: BusinessEnrichmentResult[] = []
  const reasons: string[] = []

  settled.forEach((result, index) => {
    const provider = selected[index]
    if (result.status === 'fulfilled') {
      providerResults.push(result.value)
      reasons.push(...result.value.reasons)
      return
    }

    providerResults.push({
      providerId: provider.id,
      disposition: 'FAILED',
      evidence: [],
      fields: {},
      reasons: [`${provider.id} failed: ${String(result.reason)}`],
    })
  })

  const evidence = providerResults.flatMap((result) => result.evidence)
  const successful = providerResults.filter((result) => result.disposition === 'ENRICHED')
  const rateLimited = providerResults.filter((result) => result.disposition === 'RATE_LIMITED')
  const reviewRequired = providerResults.filter((result) => result.disposition === 'REVIEW_REQUIRED')

  let disposition: EnrichmentDisposition = 'NO_MATCH'
  if (reviewRequired.length > 0) disposition = 'REVIEW_REQUIRED'
  else if (successful.length > 0) disposition = 'ENRICHED'
  else if (rateLimited.length === providerResults.length) disposition = 'RATE_LIMITED'
  else if (providerResults.some((result) => result.disposition === 'PARTIAL')) disposition = 'PARTIAL'
  else if (providerResults.length > 0) disposition = 'FAILED'

  return {
    principalId: request.principalId,
    corporateEntityId: request.corporateEntityId,
    disposition,
    providerResults,
    evidence,
    reasons: [...new Set(reasons)],
  }
}
