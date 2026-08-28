import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { MonetizationCandidate } from './monetization-candidate.js';

export interface OfferDiscoveryQuery {
  topic: string;
  audience?: string;
  niche?: string;
  surface?: string;
  maxResults?: number;
}

export interface DiscoveredOffer extends MonetizationCandidate {
  discoveredAt: ISODateTime;
  externalOfferId?: string;
  merchantName?: string;
  category?: string;
}

/** Provider-neutral contract for finding commercially relevant offers. */
export interface OfferDiscoveryAdapter {
  readonly provider: string;
  discover(query: OfferDiscoveryQuery): Promise<readonly DiscoveredOffer[]>;
}

export interface OfferDiscoveryResult {
  query: OfferDiscoveryQuery;
  offers: readonly DiscoveredOffer[];
  discoveredAt: ISODateTime;
}

export function rankDiscoveredOffers(offers: readonly DiscoveredOffer[]): DiscoveredOffer[] {
  return [...offers].sort((a, b) => {
    const aScore = a.audienceFit + a.demandFit + a.evidenceQuality + a.commissionOrMarginPct - a.complianceRisk - a.fulfillmentDifficulty;
    const bScore = b.audienceFit + b.demandFit + b.evidenceQuality + b.commissionOrMarginPct - b.complianceRisk - b.fulfillmentDifficulty;
    return bScore - aScore;
  });
}

export const offerId = (provider: string, externalId: string): GrowthId =>
  `offer:${provider}:${externalId}` as GrowthId;
