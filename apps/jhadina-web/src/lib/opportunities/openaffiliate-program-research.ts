import "server-only"

import {
  OpenAffiliateHttpClient,
  OpenAffiliateProgramDiscoveryAdapter,
  type AffiliateCommissionType,
  type AffiliateProgramObservation,
  type OpenAffiliateFetch,
} from "@jhadina/commerce-adapters"
import { isSideHustleProfile } from "@jhadina/opportunity-core"
import type { StoredCanonicalOpportunity } from "./canonical"

export type AffiliateProgramResearchRepository = {
  get(id: string): Promise<StoredCanonicalOpportunity | undefined>
}

export type AffiliateProgramResearchResult = {
  opportunityId: string
  provider: "openaffiliate"
  query: string
  category?: string
  commissionType?: AffiliateCommissionType
  verifiedOnly: boolean
  observedAt: string
  programs: AffiliateProgramObservation[]
  evidenceRefs: string[]
  officialTermsVerificationRequired: string[]
  readOnly: true
  externalActionAuthorized: false
  publishingAuthorized: false
  applicationAuthorized: false
  moneyMovementAuthorized: false
}

export async function researchOpenAffiliateProgramsForOpportunity(
  input: {
    opportunityId: string
    query?: string
    category?: string
    commissionType?: AffiliateCommissionType
    verifiedOnly?: boolean
    limit?: number
    observedAt?: string
    fetchFn?: typeof fetch
  },
  repository: AffiliateProgramResearchRepository,
): Promise<AffiliateProgramResearchResult> {
  const opportunityId = requireText(input.opportunityId, "opportunityId")
  const stored = await repository.get(opportunityId)
  if (!stored) throw new Error("AFFILIATE_PROGRAM_RESEARCH_OPPORTUNITY_NOT_FOUND")

  const profile = stored.opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile) || profile.family !== "commerce_affiliate") {
    throw new Error("AFFILIATE_PROGRAM_RESEARCH_REQUIRES_COMMERCE_AFFILIATE")
  }

  const query = input.query?.trim() || stored.opportunity.title.trim()
  const category = cleanOptional(input.category)
  if (!query && !category) {
    throw new Error("AFFILIATE_PROGRAM_RESEARCH_QUERY_OR_CATEGORY_REQUIRED")
  }

  const observedAt = input.observedAt ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new Error("AFFILIATE_PROGRAM_RESEARCH_OBSERVED_AT_INVALID")
  }

  const fetchFn = input.fetchFn ?? fetch
  const fetchAdapter: OpenAffiliateFetch = async (url, init) => {
    const response = await fetchFn(url, {
      method: "GET",
      headers: init?.headers,
      cache: "no-store",
    })
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: () => response.json(),
    }
  }

  const client = new OpenAffiliateHttpClient(fetchAdapter)
  const adapter = new OpenAffiliateProgramDiscoveryAdapter(
    client,
    () => observedAt,
  )
  const programs = await adapter.search({
    query: query || undefined,
    category,
    commissionType: input.commissionType,
    verifiedOnly: input.verifiedOnly ?? true,
    limit: Math.max(1, Math.min(input.limit ?? 25, 50)),
  })

  return {
    opportunityId,
    provider: "openaffiliate",
    query,
    category,
    commissionType: input.commissionType,
    verifiedOnly: input.verifiedOnly ?? true,
    observedAt: new Date(Date.parse(observedAt)).toISOString(),
    programs,
    evidenceRefs: unique(programs.flatMap((program) => program.evidenceRefs)),
    officialTermsVerificationRequired: programs.map((program) => program.programId),
    readOnly: true,
    externalActionAuthorized: false,
    publishingAuthorized: false,
    applicationAuthorized: false,
    moneyMovementAuthorized: false,
  }
}

function requireText(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

function cleanOptional(value?: string): string | undefined {
  const cleaned = value?.trim()
  return cleaned || undefined
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
