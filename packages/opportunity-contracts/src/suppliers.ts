import type { OpportunityEvidence } from "./evidence";

export interface SupplierSearchRequest {
  query: string;
  limit?: number;
  cursor?: string;
}

export interface SupplierOffer {
  supplierId: string;
  productId?: string;
  title?: string;
  unitCost?: number;
  currency?: string;
  minimumOrderQuantity?: number;
  availability?: unknown;
  shipping?: unknown;
  terms?: unknown;
}

export interface SupplierDiscoveryProvider {
  readonly providerId: string;
  search(request: SupplierSearchRequest): Promise<OpportunityEvidence<SupplierOffer>[]>;
  getSupplier(supplierId: string): Promise<OpportunityEvidence | null>;
  getProductOffer?(supplierId: string, productId: string): Promise<OpportunityEvidence<SupplierOffer> | null>;
}
