import type { CanonicalCapitalEvent, CapitalDomain } from './taxonomy';

export type VenueObservation = {
  sourceId: string;
  accountId: string;
  domain: CapitalDomain;
  instrument: string;
  venue: string;
  event: 'fill' | 'settlement' | 'payout' | 'fee' | 'transfer';
  side?: 'buy' | 'sell';
  quantity?: number;
  price?: { amount: number; currency: string };
  occurredAt: string;
  metadata?: Record<string, string | number | boolean>;
};

export interface CapitalVenueAdapter {
  readonly domain: CapitalDomain;
  normalize(observation: VenueObservation): CanonicalCapitalEvent;
}

export function createVenueObservationEvent(observation: VenueObservation): CanonicalCapitalEvent {
  const kind = observation.event === 'fill'
    ? (observation.side === 'buy' ? 'acquisition' : 'disposition')
    : observation.event === 'payout'
      ? 'payout'
      : observation.event === 'fee'
        ? 'fee'
        : observation.event === 'settlement'
          ? (observation.side === 'sell' ? 'disposition' : 'acquisition')
          : 'transfer';

  return {
    sourceTransactionId: observation.sourceId,
    accountId: observation.accountId,
    asset: {
      domain: observation.domain,
      instrument: observation.instrument,
      venue: observation.venue,
      quoteCurrency: observation.price?.currency,
    },
    kind,
    quantity: observation.quantity,
    notional: observation.price,
    occurredAt: observation.occurredAt,
    confidence: 1,
    classificationReason: `Explicit venue observation: ${observation.event}`,
  };
}
