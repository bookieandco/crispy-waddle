export interface Money {
  amountMinor: number;
  currency: string;
}

export interface OfferCandidate {
  offerId: string;
  merchantId: string;
  locationId: string;
  productId: string;
  productName: string;
  price: Money;
  taxes: Money;
  deliveryFee: Money;
  platformFee: Money;
  availableQuantity: number;
  estimatedDeliveryMinutes?: number;
  inventoryCheckedAt: string;
  inventorySource: string;
  inventoryVersion?: string;
  jurisdictionId: string;
  policyVersion: string;
  eligible: boolean;
  eligibilityReasons?: string[];
  expiresAt: string;
}

export interface MarketplaceOffer extends OfferCandidate {
  total: Money;
  ranking: {
    score: number;
    reasons: string[];
  };
}

export type RankingMode = "lowest_price" | "fastest" | "best_value";

export interface OfferSearchRequest {
  productId?: string;
  query?: string;
  jurisdictionId: string;
  deliveryZoneId: string;
  quantity: number;
  mode: RankingMode;
  now: string;
}

export interface OfferRankingPolicy {
  priceWeight: number;
  etaWeight: number;
  reliabilityWeight: number;
}

export interface MerchantReliability {
  merchantId: string;
  fulfillmentRate: number;
  inventoryAccuracyRate: number;
}

export function addMoney(...values: Money[]): Money {
  if (values.length === 0) throw new Error("At least one money value is required");
  const currency = values[0].currency;
  if (values.some((value) => value.currency !== currency)) {
    throw new Error("All offer amounts must use the same currency");
  }
  return {
    amountMinor: values.reduce((sum, value) => sum + value.amountMinor, 0),
    currency,
  };
}

export function calculateOfferTotal(candidate: OfferCandidate): Money {
  return addMoney(candidate.price, candidate.taxes, candidate.deliveryFee, candidate.platformFee);
}

function normalizedLowerIsBetter(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return (max - value) / (max - min);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function rankOffers(
  candidates: OfferCandidate[],
  mode: RankingMode,
  reliability: MerchantReliability[] = [],
): MarketplaceOffer[] {
  const eligible = candidates.filter((candidate) => candidate.eligible && candidate.availableQuantity > 0);
  const offers = eligible.map((candidate) => ({
    ...candidate,
    total: calculateOfferTotal(candidate),
    ranking: { score: 0, reasons: [] as string[] },
  }));

  if (offers.length === 0) return [];

  const totals = offers.map((offer) => offer.total.amountMinor);
  const etas = offers.map((offer) => offer.estimatedDeliveryMinutes ?? Number.MAX_SAFE_INTEGER);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);
  const minEta = Math.min(...etas);
  const maxEta = Math.max(...etas);

  for (const offer of offers) {
    const priceScore = normalizedLowerIsBetter(offer.total.amountMinor, minTotal, maxTotal);
    const etaScore = offer.estimatedDeliveryMinutes === undefined
      ? 0
      : normalizedLowerIsBetter(offer.estimatedDeliveryMinutes, minEta, maxEta);
    const merchant = reliability.find((item) => item.merchantId === offer.merchantId);
    const reliabilityScore = merchant
      ? clamp01((merchant.fulfillmentRate + merchant.inventoryAccuracyRate) / 2)
      : 0.5;

    let score: number;
    if (mode === "lowest_price") {
      score = priceScore;
    } else if (mode === "fastest") {
      score = etaScore;
    } else {
      score = priceScore * 0.55 + etaScore * 0.25 + reliabilityScore * 0.20;
    }

    const reasons: string[] = [];
    if (offer.total.amountMinor === minTotal) reasons.push("lowest delivered total");
    if (offer.estimatedDeliveryMinutes === minEta) reasons.push("fastest estimated delivery");
    if (reliabilityScore >= 0.9) reasons.push("high merchant fulfillment reliability");
    if (offer.availableQuantity >= 2) reasons.push("inventory currently available");

    offer.ranking = { score, reasons };
  }

  return offers.sort((a, b) => b.ranking.score - a.ranking.score);
}

export function buildOfferSearchResult(
  request: OfferSearchRequest,
  candidates: OfferCandidate[],
  reliability: MerchantReliability[] = [],
): MarketplaceOffer[] {
  const matching = candidates.filter((candidate) =>
    candidate.jurisdictionId === request.jurisdictionId &&
    candidate.availableQuantity >= request.quantity &&
    candidate.expiresAt > request.now,
  );

  return rankOffers(matching, request.mode, reliability);
}

export const OFFER_ENGINE_VERSION = "0.1.0" as const;
