import type { FulfillmentProvider } from './fulfillment-provider.js'
import type { OpportunityRequirementSet } from './opportunity-requirement.js'
import { isProviderAddressableRequirement, rankFulfillmentProviders, type FulfillmentProviderMatch } from './provider-matching.js'

export type FulfillmentPlanStructure =
  | 'direct_fulfillment'
  | 'prime_with_subcontractor'
  | 'teaming'
  | 'specialist_vendor'
  | 'unresolved'

export type FulfillmentPlanAssignmentRole = 'lead' | 'subcontractor' | 'teaming_partner' | 'specialist_vendor'

export type FulfillmentPlanAssignment = {
  providerId: string
  role: FulfillmentPlanAssignmentRole
  requirementIds: string[]
  evidenceRefs: string[]
  score: number
}

export type FulfillmentPlan = {
  opportunityId: string
  structure: FulfillmentPlanStructure
  assignments: FulfillmentPlanAssignment[]
  coveredRequirementIds: string[]
  uncoveredRequirementIds: string[]
  blockers: string[]
  rationale: string[]
  requiresHumanApproval: true
  engagementAuthorized: false
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function satisfiedRequiredIds(match: FulfillmentProviderMatch, requiredIds: Set<string>): string[] {
  return match.matches
    .filter((item) => requiredIds.has(item.requirementId) && item.status === 'satisfied')
    .map((item) => item.requirementId)
}

function evidenceFor(match: FulfillmentProviderMatch, ids: string[]): string[] {
  return uniq(match.matches.filter((item) => ids.includes(item.requirementId)).flatMap((item) => item.evidenceRefs))
}

export function buildFulfillmentPlan(
  set: OpportunityRequirementSet,
  providers: FulfillmentProvider[],
): FulfillmentPlan {
  const ranked = rankFulfillmentProviders(set, providers)
  const providerRequired = set.requirements.filter((item) => item.severity === 'required' && isProviderAddressableRequirement(item))
  const requiredIds = new Set(providerRequired.map((item) => item.id))
  const primeOnlyIds = new Set(providerRequired.filter((item) => item.kind === 'socioeconomic').map((item) => item.id))
  const assignments: FulfillmentPlanAssignment[] = []
  const covered = new Set<string>()
  const blockers = [...set.unresolved]
  const rationale: string[] = []

  const single = ranked.find((match) =>
    match.disposition === 'qualified_candidate' &&
    [...requiredIds].every((id) => satisfiedRequiredIds(match, requiredIds).includes(id)),
  )

  if (single) {
    const ids = satisfiedRequiredIds(single, requiredIds)
    assignments.push({ providerId: single.providerId, role: 'lead', requirementIds: ids, evidenceRefs: evidenceFor(single, ids), score: single.score })
    ids.forEach((id) => covered.add(id))
    rationale.push('One verified provider has evidence-backed coverage for all required requirements.')
    return {
      opportunityId: set.opportunityId,
      structure: 'direct_fulfillment',
      assignments,
      coveredRequirementIds: [...covered],
      uncoveredRequirementIds: [...requiredIds].filter((id) => !covered.has(id)),
      blockers: uniq(blockers),
      rationale,
      requiresHumanApproval: true,
      engagementAuthorized: false,
    }
  }

  const candidates = ranked.filter((match) => match.disposition !== 'blocked')
  while (covered.size < requiredIds.size) {
    let best: { match: FulfillmentProviderMatch; ids: string[] } | undefined
    for (const match of candidates) {
      if (assignments.some((assignment) => assignment.providerId === match.providerId)) continue
      const satisfied = satisfiedRequiredIds(match, requiredIds)
      if (assignments.length === 0 && [...primeOnlyIds].some((id) => !satisfied.includes(id))) continue
      const ids = satisfied.filter((id) => !covered.has(id) && (assignments.length === 0 || !primeOnlyIds.has(id)))
      if (ids.length === 0) continue
      if (!best || ids.length > best.ids.length || (ids.length === best.ids.length && match.score > best.match.score)) best = { match, ids }
    }
    if (!best) break
    const role: FulfillmentPlanAssignmentRole = assignments.length === 0 ? 'lead' : 'subcontractor'
    assignments.push({ providerId: best.match.providerId, role, requirementIds: best.ids, evidenceRefs: evidenceFor(best.match, best.ids), score: best.match.score })
    best.ids.forEach((id) => covered.add(id))
  }

  const uncovered = [...requiredIds].filter((id) => !covered.has(id))
  if (assignments.length > 1 && uncovered.length === 0) {
    rationale.push('No single qualified candidate covers the full requirement set; complementary verified providers cover the required work.')
  } else if (assignments.length === 1 && uncovered.length > 0) {
    rationale.push('A lead candidate exists, but required capability gaps remain.')
  } else if (assignments.length === 0) {
    rationale.push('No non-blocked provider has evidence-backed coverage for a required requirement.')
  }

  if (uncovered.length > 0) blockers.push(`Uncovered required requirements: ${uncovered.join(', ')}`)
  let structure: FulfillmentPlanStructure = 'unresolved'
  if (assignments.length > 1 && uncovered.length === 0) structure = 'prime_with_subcontractor'
  else if (assignments.length === 1 && uncovered.length === 0) structure = 'direct_fulfillment'

  return {
    opportunityId: set.opportunityId,
    structure,
    assignments,
    coveredRequirementIds: [...covered],
    uncoveredRequirementIds: uncovered,
    blockers: uniq(blockers),
    rationale: uniq(rationale),
    requiresHumanApproval: true,
    engagementAuthorized: false,
  }
}

export function buildProviderShortlist(
  set: OpportunityRequirementSet,
  providers: FulfillmentProvider[],
  limit = 5,
): FulfillmentProviderMatch[] {
  return rankFulfillmentProviders(set, providers)
    .filter((match) => match.disposition !== 'blocked')
    .slice(0, Math.max(1, limit))
}
