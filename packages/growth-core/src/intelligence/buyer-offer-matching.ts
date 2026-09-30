import type { GrowthId } from '../domain/types.js';
import type { ActiveBuyerSignal } from './active-buyer-intelligence.js';

export interface OfferMatchCandidate {
  readonly offerId: GrowthId;
  readonly name: string;
  readonly topics: readonly string[];
  readonly audienceTags: readonly string[];
  readonly commercialSignals: readonly string[];
  readonly availability: 'available' | 'limited' | 'unavailable';
}

export interface BuyerOfferMatch {
  readonly buyerSignalId: GrowthId;
  readonly offerId: GrowthId;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly intentLevel: ActiveBuyerSignal['intentLevel'];
  readonly availability: OfferMatchCandidate['availability'];
}

const normalize = (value: string) => value.trim().toLowerCase();

export function matchBuyerToOffers(
  signal: ActiveBuyerSignal,
  offers: readonly OfferMatchCandidate[],
): readonly BuyerOfferMatch[] {
  const topic = normalize(signal.topic);
  return offers
    .filter((offer) => offer.availability !== 'unavailable')
    .map((offer) => {
      const topics = offer.topics.map(normalize);
      const topicMatch = topics.some((candidate) => candidate === topic || candidate.includes(topic) || topic.includes(candidate)) ? 0.55 : 0;
      const signalMatch = signal.evidence.length === 0 ? 0 : Math.min(0.25, signal.evidence.length * 0.05);
      const availability = offer.availability === 'available' ? 0.2 : 0.1;
      const score = Math.min(1, topicMatch + signalMatch + availability);
      const reasons = [
        ...(topicMatch ? [`Topic match: ${signal.topic}`] : []),
        ...(signalMatch ? [`Buyer evidence: ${signal.evidence.length} matched signal(s)`] : []),
        ...(availability === 0.2 ? ['Offer is currently available'] : ['Offer availability is limited']),
      ];
      return { buyerSignalId: signal.id, offerId: offer.offerId, score, reasons, intentLevel: signal.intentLevel, availability: offer.availability };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
}
