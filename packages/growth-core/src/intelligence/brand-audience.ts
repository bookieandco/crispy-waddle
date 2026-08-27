import type { GrowthId } from '../domain/types.js';
import type { DistributionOpportunity } from './distribution-opportunity.js';

export interface BrandAudienceProfile {
  brandId: GrowthId;
  name: string;
  mission: string;
  audienceSignals: readonly string[];
  excludedSignals?: readonly string[];
  preferredSurfaces?: readonly string[];
  tone?: readonly string[];
  objectives?: readonly string[];
}

export interface OpportunityFit {
  opportunity: DistributionOpportunity;
  fitScore: number;
  matchedSignals: readonly string[];
  excludedSignals: readonly string[];
  recommended: boolean;
}

const normalize = (value: string) => value.toLowerCase().trim();

export function scoreBrandAudienceFit(profile: BrandAudienceProfile, opportunity: DistributionOpportunity): OpportunityFit {
  const haystack = normalize(`${opportunity.title} ${opportunity.rationale}`);
  const matchedSignals = profile.audienceSignals.filter((signal) => haystack.includes(normalize(signal)));
  const excludedSignals = (profile.excludedSignals ?? []).filter((signal) => haystack.includes(normalize(signal)));
  const surfaceMatch = profile.preferredSurfaces?.includes(opportunity.surfaceId) ? 20 : 0;
  const signalScore = profile.audienceSignals.length ? (matchedSignals.length / profile.audienceSignals.length) * 60 : 0;
  const fitScore = Math.max(0, Math.min(100, signalScore + surfaceMatch + opportunity.audienceFit * 0.2 - excludedSignals.length * 30));
  return { opportunity, fitScore: Math.round(fitScore * 100) / 100, matchedSignals, excludedSignals, recommended: excludedSignals.length === 0 && fitScore >= 60 };
}

export function rankOpportunitiesForBrand(profile: BrandAudienceProfile, opportunities: readonly DistributionOpportunity[]): OpportunityFit[] {
  return opportunities.map((opportunity) => scoreBrandAudienceFit(profile, opportunity)).sort((a, b) => (b.fitScore + b.opportunity.score) - (a.fitScore + a.opportunity.score));
}
