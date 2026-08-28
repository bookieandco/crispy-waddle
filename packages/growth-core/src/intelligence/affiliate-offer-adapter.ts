import type { GrowthId } from '../domain/types.js';
import type { MonetizationCandidate } from './monetization-candidate.js';

/** Provider-neutral normalized affiliate/product record. */
export interface AffiliateOfferRecord {
  id: string;
  name: string;
  network?: string;
  url?: string;
  price?: number;
  payout?: number;
  commissionPct?: number;
  category?: string;
  audienceFit?: number;
  demandFit?: number;
  conversionRateEstimatePct?: number;
  evidenceQuality?: number;
  fulfillmentDifficulty?: number;
  complianceRisk?: number;
  observedAt?: string;
  source?: string;
}

export interface AffiliateOfferAdapterOptions {
  defaultAudienceFit?: number;
  defaultDemandFit?: number;
  defaultConversionRateEstimatePct?: number;
  defaultEvidenceQuality?: number;
  defaultFulfillmentDifficulty?: number;
  defaultComplianceRisk?: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Normalize an external affiliate/product catalog item into Growth Core's
 * monetization contract. This adapter deliberately does not claim that
 * payout, revenue, reviews, or compliance assertions are verified.
 */
export function normalizeAffiliateOffer(
  offer: AffiliateOfferRecord,
  options: AffiliateOfferAdapterOptions = {},
): MonetizationCandidate {
  const payout = offer.payout ?? 0;
  const price = offer.price ?? payout;
  const commissionPct = offer.commissionPct ?? (price > 0 ? (payout / price) * 100 : 0);

  return {
    id: `affiliate-offer:${offer.id}` as GrowthId,
    name: offer.name,
    model: 'affiliate',
    audienceFit: clamp(offer.audienceFit ?? options.defaultAudienceFit ?? 50),
    demandFit: clamp(offer.demandFit ?? options.defaultDemandFit ?? 50),
    commissionOrMarginPct: clamp(commissionPct),
    estimatedValuePerConversion: Math.max(0, payout),
    conversionRateEstimatePct: clamp(offer.conversionRateEstimatePct ?? options.defaultConversionRateEstimatePct ?? 1),
    evidenceQuality: clamp(offer.evidenceQuality ?? options.defaultEvidenceQuality ?? 25),
    fulfillmentDifficulty: clamp(offer.fulfillmentDifficulty ?? options.defaultFulfillmentDifficulty ?? 50),
    complianceRisk: clamp(offer.complianceRisk ?? options.defaultComplianceRisk ?? 50),
    landingDestination: offer.url,
    source: offer.source ?? offer.network ?? 'affiliate',
  };
}

export function normalizeAffiliateOffers(
  offers: readonly AffiliateOfferRecord[],
  options: AffiliateOfferAdapterOptions = {},
): MonetizationCandidate[] {
  return offers.map((offer) => normalizeAffiliateOffer(offer, options));
}
