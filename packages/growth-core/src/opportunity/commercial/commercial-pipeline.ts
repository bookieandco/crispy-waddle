import type { Opportunity, OpportunityMatch, OpportunityRepository, OpportunityScore } from '../domain/index.js'
import { calculateOpportunityScore } from '../domain/opportunity-score.js'
import type { CommercialOpportunityRecord } from './commercial-opportunity.js'
import { normalizeCommercialOpportunity } from './commercial-opportunity.js'

type CommercialEnrichers = {
  score?: (opportunity: Opportunity) => OpportunityScore
  match?: (opportunity: Opportunity) => OpportunityMatch
}

/** Deterministic commercial ingestion boundary. No LLM is required to persist a candidate. */
export async function ingestCommercialOpportunity(
  record: CommercialOpportunityRecord,
  userId: string,
  queue: { ingest(opportunities: readonly Opportunity[]): Opportunity[] },
  repository: OpportunityRepository,
  enrichers: CommercialEnrichers = {},
): Promise<Opportunity> {
  const normalized = normalizeCommercialOpportunity(record, userId)
  const score = enrichers.score?.(normalized) ?? calculateCommercialScore(normalized)
  const matched = enrichers.match?.({ ...normalized, score })
  const opportunity: Opportunity = { ...normalized, score, match: matched }
  queue.ingest([opportunity])
  return repository.upsert(opportunity)
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function calculateCommercialScore(opportunity: Opportunity): OpportunityScore {
  const evidence = opportunity.evidence
  const evidenceConfidence = average(evidence.map(item => item.confidence)) * 100
  const hasBuyer = opportunity.buyer ? 70 : 20
  const hasProblem = opportunity.problem ? 70 : 20
  const hasLowCost = opportunity.economics.startupCost === undefined
    ? 40
    : Math.max(0, 100 - Math.min(100, opportunity.economics.startupCost))
  const recurring = opportunity.economics.recurringRevenue ? 90 : 35

  return calculateOpportunityScore({
    demand: evidenceConfidence,
    buyerValue: hasBuyer,
    distributionPotential: hasProblem,
    aiLeverage: opportunity.strategy === 'digital_product' || opportunity.strategy === 'software' ? 85 : 55,
    recurringRevenue: recurring,
    competition: 50,
    startupCost: hasLowCost,
    operationalComplexity: 45,
    regulatoryRisk: 20,
    evidenceConfidence,
    personalFit: 50,
  })
}
