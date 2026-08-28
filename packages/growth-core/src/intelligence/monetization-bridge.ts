import type { GrowthId } from '../domain/types.js';
import { assessMonetization, type MonetizationAssessment, type MonetizationCandidate } from './monetization-candidate.js';
import type { TikTokDistributionBridgeResult } from './tiktok-distribution-bridge.js';
import type { OfferVerification } from './offer-verification.js';

export interface MonetizedOpportunity {
  opportunityId: GrowthId;
  offerId: GrowthId;
  monetization: MonetizationAssessment;
  verification: OfferVerification;
  experimentEligible: boolean;
  decision: 'experiment' | 'hold' | 'reject';
}

export function attachOfferToOpportunity(
  bridge: TikTokDistributionBridgeResult,
  offer: MonetizationCandidate,
  verification: OfferVerification,
): MonetizedOpportunity {
  const monetization = assessMonetization(offer);
  const eligible = verification.status === 'verified' && verification.evidenceQuality >= 60 && verification.complianceRisk < 80;
  const experimentEligible = eligible && monetization.recommendation !== 'reject' && bridge.score.recommendation !== 'stop';

  return {
    opportunityId: bridge.opportunity.id,
    offerId: offer.id,
    monetization,
    verification,
    experimentEligible,
    decision: experimentEligible ? 'experiment' : verification.status === 'rejected' ? 'reject' : 'hold',
  };
}

export function rankMonetizedOpportunities(items: readonly MonetizedOpportunity[]): MonetizedOpportunity[] {
  return [...items].sort((a, b) => {
    const aScore = a.monetization.score + (a.experimentEligible ? 25 : 0) - a.verification.complianceRisk;
    const bScore = b.monetization.score + (b.experimentEligible ? 25 : 0) - b.verification.complianceRisk;
    return bScore - aScore;
  });
}
