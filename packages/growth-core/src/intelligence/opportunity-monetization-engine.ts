import type { GrowthId } from '../domain/types.js';
import { bridgeTikTokTrendToDistributionOpportunity, type TikTokDistributionBridgeResult, type TikTokTrendSignal } from './tiktok-distribution-bridge.js';
import { attachOfferToOpportunity, rankMonetizedOpportunities, type MonetizedOpportunity } from './monetization-bridge.js';
import { rankDiscoveredOffers, type DiscoveredOffer, type OfferDiscoveryAdapter } from './offer-discovery.js';
import type { OfferVerificationAdapter } from './offer-verification.js';

export interface OpportunityMonetizationQuery {
  audience?: string;
  niche?: string;
  maxOffersPerOpportunity?: number;
  minOpportunityScore?: number;
}

export interface OpportunityMonetizationResult {
  runId: GrowthId;
  opportunities: readonly MonetizedOpportunity[];
  sourceSignals: readonly TikTokTrendSignal[];
  consideredOffers: number;
}

/**
 * Turns a scored distribution signal into a commercially testable opportunity.
 * Discovery and verification are provider-neutral; this engine never publishes,
 * buys traffic, or assumes that an affiliate/product claim is true.
 */
export async function monetizeTikTokOpportunities(
  signals: readonly TikTokTrendSignal[],
  offerDiscovery: OfferDiscoveryAdapter,
  offerVerification: OfferVerificationAdapter,
  query: OpportunityMonetizationQuery = {},
): Promise<OpportunityMonetizationResult> {
  const minScore = query.minOpportunityScore ?? 55;
  const maxOffers = Math.max(1, query.maxOffersPerOpportunity ?? 5);
  const eligibleSignals = signals
    .map(bridgeTikTokTrendToDistributionOpportunity)
    .filter((bridge) => bridge.score.score >= minScore && bridge.score.recommendation !== 'stop');

  const results: MonetizedOpportunity[] = [];
  let consideredOffers = 0;

  for (const bridge of eligibleSignals) {
    const offers = await offerDiscovery.discover({
      topic: bridge.signal.topic,
      audience: query.audience,
      niche: query.niche,
      surface: bridge.opportunity.surfaceId,
      maxResults: maxOffers,
    });

    const ranked = rankDiscoveredOffers(offers).slice(0, maxOffers);
    consideredOffers += ranked.length;

    for (const offer of ranked) {
      const verification = await offerVerification.verify(offer);
      results.push(attachOfferToOpportunity(bridge, offer, verification));
    }
  }

  return {
    runId: `growth-run:monetization:${Date.now()}` as GrowthId,
    opportunities: rankMonetizedOpportunities(results),
    sourceSignals: signals,
    consideredOffers,
  };
}

export interface MonetizationInputAdapter {
  toTikTokSignal(input: unknown): TikTokTrendSignal;
}

/** Small adapter boundary for future non-TikTok opportunity sources. */
export function monetizeSignals(
  signals: readonly TikTokTrendSignal[],
  offerDiscovery: OfferDiscoveryAdapter,
  offerVerification: OfferVerificationAdapter,
  query?: OpportunityMonetizationQuery,
): Promise<OpportunityMonetizationResult> {
  return monetizeTikTokOpportunities(signals, offerDiscovery, offerVerification, query);
}

export type { DiscoveredOffer, TikTokDistributionBridgeResult };
