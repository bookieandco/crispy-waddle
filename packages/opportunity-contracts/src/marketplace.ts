import type { OpportunityEvidence } from "./evidence";

export interface MarketplaceProduct {
  marketplace: string;
  productId: string;
  title?: string;
  url?: string;
  price?: number;
  currency?: string;
  variants?: unknown[];
  seller?: unknown;
  availability?: unknown;
}

export interface MarketplaceSearchRequest {
  query: string;
  limit?: number;
  cursor?: string;
}

export interface MarketplaceDataProvider {
  readonly providerId: string;
  search(request: MarketplaceSearchRequest): Promise<OpportunityEvidence<MarketplaceProduct>[]>;
  getProduct(productId: string): Promise<OpportunityEvidence<MarketplaceProduct> | null>;
  getVariants?(productId: string): Promise<OpportunityEvidence[]>;
  getSeller?(sellerId: string): Promise<OpportunityEvidence>;
  getAvailability?(productId: string): Promise<OpportunityEvidence>;
}
