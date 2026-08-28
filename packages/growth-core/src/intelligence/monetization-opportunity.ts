import type { GrowthId } from '../domain/types.js';
import { assessMonetization, type MonetizationAssessment, type MonetizationCandidate } from './monetization-candidate.js';
import { scoreOpportunityV1, type OpportunityScoringV1Result } from './opportunity-scoring-v1.js';

export interface MonetizedOpportunityResult {
  opportunityId: GrowthId;
  opportunityScore: OpportunityScoringV1Result;
  monetization: readonly MonetizationAssessment[];
  bestCandidateId?: GrowthId;
  experimentWorthiness: 'high' | 'medium' | 'low' | 'reject';
}

export function enrichOpportunityWithMonetization(
  opportunityScore: OpportunityScoringV1Result,
  candidates: readonly MonetizationCandidate[],
): MonetizedOpportunityResult {
  const monetization = candidates.map(assessMonetization).sort((a, b) => b.score - a.score);
  const best = monetization[0];

  let experimentWorthiness: MonetizedOpportunityResult['experimentWorthiness'];
  if (!best || best.recommendation === 'reject') experimentWorthiness = 'reject';
  else if (opportunityScore.score >= 75 && best.score >= 75) experimentWorthiness = 'high';
  else if (opportunityScore.score >= 50 && best.score >= 55) experimentWorthiness = 'medium';
  else experimentWorthiness = 'low';

  return {
    opportunityId: opportunityScore.id,
    opportunityScore,
    monetization,
    bestCandidateId: best?.candidateId,
    experimentWorthiness,
  };
}
