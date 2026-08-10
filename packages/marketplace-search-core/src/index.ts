export interface SearchRequest {
  query?: string;
  jurisdictionId: string;
  deliveryZoneId: string;
  category?: string;
  brand?: string;
  limit?: number;
  sort?: "best_value" | "price" | "delivery_time";
}

export interface OfferCandidate {
  offerId: string;
  merchantId: string;
  locationId: string;
  normalizedProductId: string;
  name: string;
  brand?: string;
  category: string;
  itemPrice: { amount: number; currency: string };
  tax?: { amount: number; currency: string };
  merchantFee?: { amount: number; currency: string };
  deliveryFee?: { amount: number; currency: string };
  estimatedDeliveryMinutes?: number;
  availability: "available" | "out_of_stock" | "hidden" | "restricted";
  deliveryZoneIds: string[];
  jurisdictionId: string;
  policyVersion: string;
}

export interface RankedOffer {
  offer: OfferCandidate;
  deliveredPrice: { amount: number; currency: string };
  score: number;
  reasons: string[];
}

export interface SearchProvider {
  search(request: SearchRequest): Promise<OfferCandidate[]>;
}

export interface SearchPolicy {
  jurisdictionId: string;
  policyVersion: string;
  allowHidden: boolean;
  requireAvailable: boolean;
  currency: string;
}

export interface MarketplaceSearchResult {
  request: SearchRequest;
  policyVersion: string;
  results: RankedOffer[];
  searchedAt: string;
}

export class MarketplaceSearchService {
  constructor(
    private readonly provider: SearchProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async search(request: SearchRequest, policy: SearchPolicy): Promise<MarketplaceSearchResult> {
    if (request.jurisdictionId !== policy.jurisdictionId) {
      throw new Error("Search jurisdiction does not match active policy");
    }

    const candidates = await this.provider.search(request);
    const eligible = candidates.filter((offer) => {
      if (offer.jurisdictionId !== policy.jurisdictionId) return false;
      if (offer.policyVersion !== policy.policyVersion) return false;
      if (!offer.deliveryZoneIds.includes(request.deliveryZoneId)) return false;
      if (policy.requireAvailable && offer.availability !== "available") return false;
      if (!policy.allowHidden && offer.availability === "hidden") return false;
      if (request.category && offer.category.toLowerCase() !== request.category.toLowerCase()) return false;
      if (request.brand && offer.brand?.toLowerCase() !== request.brand.toLowerCase()) return false;
      if (request.query) {
        const haystack = `${offer.name} ${offer.brand ?? ""} ${offer.category}`.toLowerCase();
        if (!haystack.includes(request.query.toLowerCase())) return false;
      }
      return true;
    });

    const ranked = eligible.map((offer) => this.rank(offer, request.sort ?? "best_value"));
    ranked.sort((a, b) => b.score - a.score);

    return {
      request,
      policyVersion: policy.policyVersion,
      results: ranked.slice(0, request.limit ?? 50),
      searchedAt: this.now().toISOString(),
    };
  }

  private rank(offer: OfferCandidate, sort: SearchRequest["sort"]): RankedOffer {
    const deliveredPrice = [offer.itemPrice, offer.tax, offer.merchantFee, offer.deliveryFee]
      .filter(Boolean)
      .reduce((sum, value) => sum + (value?.amount ?? 0), 0);

    const reasons: string[] = [];
    let score = 0;

    if (offer.availability === "available") {
      score += 100;
      reasons.push("available");
    }

    if (sort === "price" || sort === "best_value") {
      score += Math.max(0, 1000 - deliveredPrice) / 10;
      reasons.push("competitive delivered price");
    }

    if (sort === "delivery_time" || sort === "best_value") {
      const minutes = offer.estimatedDeliveryMinutes ?? 120;
      score += Math.max(0, 120 - minutes);
      if (minutes <= 45) reasons.push("fast estimated delivery");
    }

    return {
      offer,
      deliveredPrice: { amount: deliveredPrice, currency: offer.itemPrice.currency },
      score,
      reasons,
    };
  }
}

export const MARKETPLACE_SEARCH_CORE_VERSION = "0.1.0" as const;
