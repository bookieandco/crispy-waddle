import type { ProviderGraph } from './provider-graph'

export type BusinessModelPath = 'FULFILL' | 'PARTNER' | 'SUBCONTRACT' | 'ACQUIRE' | 'REFER'

export type ProviderOpportunityInput = {
  opportunityId: string
  serviceId: string
  jurisdictionId: string
  requirements: string[]
  estimatedValue?: number
}

export type ProviderMatch = {
  companyId: string
  opportunityId: string
  paths: BusinessModelPath[]
  score: number
  rationale: string[]
  evidenceIds: string[]
}

/**
 * Deterministic first-pass matching. It intentionally scores only graph facts
 * already present; identity, licensing, capacity and eligibility must be
 * verified by downstream validation before action.
 */
export function matchProvidersToOpportunity(
  opportunity: ProviderOpportunityInput,
  graph: ProviderGraph,
): ProviderMatch[] {
  const companies = graph.nodes.filter((node) => node.type === 'COMPANY')
  return companies.map((company) => {
    const outgoing = graph.edges.filter((edge) => edge.fromId === company.id)
    const serviceMatch = outgoing.some((edge) => edge.type === 'PERFORMS' && edge.toId === opportunity.serviceId)
    const jurisdictionMatch = outgoing.some((edge) => edge.type === 'LOCATED_IN' && edge.toId === opportunity.jurisdictionId)
    const incumbent = outgoing.some((edge) => edge.type === 'INCUMBENT_FOR' && edge.toId === opportunity.opportunityId)
    const subcontract = outgoing.some((edge) => edge.type === 'SUBCONTRACTS')

    const score = Math.min(1, (serviceMatch ? 0.45 : 0) + (jurisdictionMatch ? 0.25 : 0) + (incumbent ? 0.2 : 0) + (subcontract ? 0.1 : 0))
    const paths: BusinessModelPath[] = []
    if (serviceMatch && jurisdictionMatch) paths.push('FULFILL')
    if (serviceMatch) paths.push('PARTNER', 'REFER')
    if (subcontract) paths.push('SUBCONTRACT')
    if (incumbent) paths.push('ACQUIRE')

    const relatedEdges = outgoing.filter((edge) =>
      edge.type === 'PERFORMS' || edge.type === 'LOCATED_IN' || edge.type === 'INCUMBENT_FOR' || edge.type === 'SUBCONTRACTS',
    )

    return {
      companyId: company.id,
      opportunityId: opportunity.opportunityId,
      paths: [...new Set(paths)],
      score,
      rationale: [
        ...(serviceMatch ? ['matches the required service'] : []),
        ...(jurisdictionMatch ? ['operates in the target jurisdiction'] : []),
        ...(incumbent ? ['has an incumbent relationship with this opportunity'] : []),
        ...(subcontract ? ['has a recorded subcontracting relationship'] : []),
      ],
      evidenceIds: [...new Set([...company.evidenceIds, ...relatedEdges.flatMap((edge) => edge.evidenceIds)])],
    }
  }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score)
}
