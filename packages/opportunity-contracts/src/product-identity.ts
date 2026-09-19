export type ProductIdentitySource =
  | "marketplace"
  | "supplier"
  | "catalog"
  | "listing"
  | "manual";

export interface ProductIdentityReference {
  source: ProductIdentitySource;
  provider: string;
  externalId: string;
  url?: string;
}

export interface CanonicalProductIdentity {
  productId: string;
  references: ProductIdentityReference[];
  canonicalName?: string;
  brand?: string;
  model?: string;
  category?: string;
  confidence: number;
  resolvedAt: string;
}

export interface ProductIdentityCandidate {
  reference: ProductIdentityReference;
  confidence: number;
  matchedFields: string[];
  evidenceIds?: string[];
}

export interface ProductIdentityResolver {
  resolve(
    reference: ProductIdentityReference,
  ): Promise<CanonicalProductIdentity | null>;

  findCandidates(
    reference: ProductIdentityReference,
  ): Promise<ProductIdentityCandidate[]>;
}
