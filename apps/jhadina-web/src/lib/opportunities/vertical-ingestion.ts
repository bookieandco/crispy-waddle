import {
  adaptCommercialOpportunity,
  adaptEmploymentOpportunity,
  adaptSamOpportunity,
  opportunityProvider,
  type CommercialOpportunityInput,
  type EmploymentOpportunityInput,
  type Opportunity,
  type OpportunityVertical,
  type SamOpportunityInput,
} from "@jhadina/opportunity-core"
import { buildOverageOpportunity, type OverageOpportunityCandidate } from "./overageAdapter"
import { createSupabaseOpportunityRepository } from "./supabase-opportunity-repository"

export async function ingestSamOpportunity(userId: string, input: SamOpportunityInput) {
  assertProviderVertical("provider:sam.gov", "government")
  return createSupabaseOpportunityRepository().upsert(userId, adaptSamOpportunity(input))
}

export async function ingestOverageOpportunity(userId: string, input: OverageOpportunityCandidate) {
  assertProviderVertical("provider:overageos", "recovery")
  return createSupabaseOpportunityRepository().upsert(userId, buildOverageOpportunity(input))
}

export async function ingestEmploymentOpportunity(userId: string, input: EmploymentOpportunityInput) {
  assertProviderVertical(input.providerId, "employment")
  return createSupabaseOpportunityRepository().upsert(userId, adaptEmploymentOpportunity(input))
}

export async function ingestCommercialOpportunity(userId: string, input: CommercialOpportunityInput) {
  const vertical = commercialVertical(input.kind)
  assertProviderVertical(input.providerId, vertical)
  return createSupabaseOpportunityRepository().upsert(userId, adaptCommercialOpportunity(input))
}

/**
 * Enforces registry truth at the ingestion boundary. Contract-only providers
 * may normalize caller-supplied evidence, but they do not gain a discovery
 * capability or execution authority by doing so.
 */
export function assertProviderVertical(providerId: string, vertical: OpportunityVertical): void {
  const provider = opportunityProvider(providerId)
  if (!provider) throw new Error(`Unknown opportunity provider: ${providerId}`)
  if (provider.vertical !== vertical) {
    throw new Error(`Opportunity provider ${providerId} is registered for ${provider.vertical}, not ${vertical}`)
  }
  if (provider.readiness === "disabled") throw new Error(`Opportunity provider is disabled: ${providerId}`)
  if (!provider.capabilities.includes("normalize")) throw new Error(`Opportunity provider cannot normalize: ${providerId}`)
}

export function canonicalOpportunityProviderId(opportunity: Opportunity): string | undefined {
  return typeof opportunity.metadata?.providerId === "string" ? opportunity.metadata.providerId : undefined
}

function commercialVertical(kind: CommercialOpportunityInput["kind"]): OpportunityVertical {
  switch (kind) {
    case "affiliate": return "affiliate"
    case "pod": return "pod"
    case "dropshipping": return "dropshipping"
    case "creator": return "creator"
    case "digital_product": return "digital_product"
    case "service": return "services"
  }
}
