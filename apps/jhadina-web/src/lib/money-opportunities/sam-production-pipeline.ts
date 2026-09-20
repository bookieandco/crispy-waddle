import {
  buildFulfillmentPlan,
  buildProviderShortlist,
  decomposeOpportunityRequirements,
  evaluateProviderFreshness,
  type FulfillmentProvider,
  type Opportunity,
} from '@jhadina/opportunity-core'

export type SamProductionCandidate = {
  opportunity: Opportunity
  requirements: ReturnType<typeof decomposeOpportunityRequirements>
  shortlist: ReturnType<typeof buildProviderShortlist>
  fulfillment: ReturnType<typeof buildFulfillmentPlan>
  freshness: ReturnType<typeof evaluateProviderFreshness>[]
  status: 'blocked' | 'review_required' | 'ready_for_human_review'
  blockers: string[]
  executionAuthorized: false
}

export function buildSamProductionCandidate(
  opportunity: Opportunity,
  providers: FulfillmentProvider[],
  now = new Date().toISOString(),
): SamProductionCandidate {
  if (opportunity.type !== 'contract' || opportunity.sourceId !== 'us.sam.gov') {
    throw new Error('SAM production candidate requires a canonical SAM.gov contract opportunity')
  }
  const requirements = decomposeOpportunityRequirements(opportunity, now)
  const shortlist = buildProviderShortlist(requirements, providers)
  const fulfillment = buildFulfillmentPlan(requirements, providers)
  const assigned = new Set(fulfillment.assignments.map((assignment) => assignment.providerId))
  const freshness = providers
    .filter((provider) => assigned.has(provider.id))
    .map((provider) => evaluateProviderFreshness(provider, now))
  const blockers = [
    ...requirements.unresolved,
    ...fulfillment.blockers,
    ...freshness.filter((result) => result.status !== 'fresh').flatMap((result) =>
      result.issues.filter((issue) => issue.blocking).map((issue) => `${result.providerId}: ${issue.message}`),
    ),
  ]
  const status: SamProductionCandidate['status'] =
    blockers.length > 0 || fulfillment.structure === 'unresolved'
      ? 'blocked'
      : shortlist.some((candidate) => candidate.disposition === 'review_required')
        ? 'review_required'
        : 'ready_for_human_review'
  return {
    opportunity,
    requirements,
    shortlist,
    fulfillment,
    freshness,
    status,
    blockers: [...new Set(blockers)],
    executionAuthorized: false,
  }
}
