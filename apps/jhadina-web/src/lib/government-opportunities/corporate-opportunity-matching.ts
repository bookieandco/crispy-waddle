import type { CorporateRecord } from './corporate-intelligence-connector'
import type { CorporateGraphMatch } from './corporate-graph-traversal'

export interface OpportunityMatchInput { opportunityId: string; jurisdiction?: string; category?: string; estimatedValue?: number; incumbentEntityId?: string }
export interface CorporateOpportunityProfile { entity: CorporateRecord; priorAwardCount: number; priorAwardValue?: number; categories: string[]; jurisdictions: string[] }
export interface CorporateOpportunityMatch { opportunityId: string; entityId: string; score: number; signals: string[]; reviewRequired: boolean }

/** Deterministic lead scoring; ranks research candidates and does not assert eligibility or award likelihood. */
export function scoreCorporateOpportunityMatch(opportunity: OpportunityMatchInput, profile: CorporateOpportunityProfile, graphMatch?: CorporateGraphMatch): CorporateOpportunityMatch {
  if (!opportunity.opportunityId || !profile.entity.id) throw new Error('opportunityId and entity id are required')
  let score = 0
  const signals: string[] = []
  if (opportunity.jurisdiction && profile.jurisdictions.some((v) => v.toLowerCase() === opportunity.jurisdiction!.toLowerCase())) { score += 20; signals.push('jurisdiction_match') }
  if (opportunity.category && profile.categories.some((v) => v.toLowerCase() === opportunity.category!.toLowerCase())) { score += 25; signals.push('category_match') }
  if (profile.priorAwardCount > 0) { score += Math.min(profile.priorAwardCount * 5, 20); signals.push('prior_awards') }
  if (opportunity.estimatedValue && profile.priorAwardValue && profile.priorAwardValue >= opportunity.estimatedValue * 0.5) { score += 15; signals.push('comparable_prior_award_value') }
  if (graphMatch) { score += Math.max(0, 15 - Math.max(0, graphMatch.distance - 1) * 5); signals.push(`corporate_graph_distance_${graphMatch.distance}`) }
  if (opportunity.incumbentEntityId === profile.entity.id) { score += 10; signals.push('known_incumbent') }
  return { opportunityId: opportunity.opportunityId, entityId: profile.entity.id, score: Math.min(score, 100), signals, reviewRequired: true }
}
