export interface ProductIdentity {
  normalizedProductId: string;
  canonicalName: string;
  category: string;
  brand?: string;
  form?: string;
  strain?: string;
  cannabinoidProfile?: Record<string, number>;
  weightGrams?: number;
}

export interface ProductCandidate {
  externalProductId: string;
  merchantId: string;
  name: string;
  brand?: string;
  category: string;
  description?: string;
  weightGrams?: number;
  form?: string;
  strain?: string;
  metadata?: Record<string, string>;
}

export interface EquivalenceEvidence {
  field: string;
  source: "exact" | "normalized" | "inferred";
  value: string;
  weight: number;
}

export interface ProductEquivalenceResult {
  candidate: ProductCandidate;
  canonicalProductId?: string;
  equivalent: boolean;
  confidence: number;
  evidence: EquivalenceEvidence[];
  requiresReview: boolean;
}

export interface ProductIdentityStore {
  findCandidates(query: {
    category: string;
    brand?: string;
    strain?: string;
    form?: string;
    weightGrams?: number;
  }): Promise<ProductIdentity[]>;
}

export interface ProductEquivalencePolicy {
  minimumConfidence: number;
  reviewConfidence: number;
  maxWeightDifferenceGrams: number;
}

const normalize = (value: string | undefined): string =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export class ProductEquivalenceService {
  constructor(private readonly store: ProductIdentityStore) {}

  async resolve(candidate: ProductCandidate, policy: ProductEquivalencePolicy): Promise<ProductEquivalenceResult> {
    const identities = await this.store.findCandidates({
      category: candidate.category,
      brand: candidate.brand,
      strain: candidate.strain,
      form: candidate.form,
      weightGrams: candidate.weightGrams,
    });

    let best: ProductEquivalenceResult | undefined;

    for (const identity of identities) {
      const evidence: EquivalenceEvidence[] = [];
      let score = 0;

      const candidateName = normalize(candidate.name);
      const canonicalName = normalize(identity.canonicalName);
      if (candidateName === canonicalName) {
        score += 0.35;
        evidence.push({ field: "name", source: "exact", value: candidate.name, weight: 0.35 });
      } else if (candidateName.includes(canonicalName) || canonicalName.includes(candidateName)) {
        score += 0.2;
        evidence.push({ field: "name", source: "normalized", value: candidate.name, weight: 0.2 });
      }

      if (candidate.brand && identity.brand && normalize(candidate.brand) === normalize(identity.brand)) {
        score += 0.2;
        evidence.push({ field: "brand", source: "exact", value: candidate.brand, weight: 0.2 });
      }

      if (candidate.category && normalize(candidate.category) === normalize(identity.category)) {
        score += 0.15;
        evidence.push({ field: "category", source: "exact", value: candidate.category, weight: 0.15 });
      }

      if (candidate.form && identity.form && normalize(candidate.form) === normalize(identity.form)) {
        score += 0.1;
        evidence.push({ field: "form", source: "exact", value: candidate.form, weight: 0.1 });
      }

      if (candidate.strain && identity.strain && normalize(candidate.strain) === normalize(identity.strain)) {
        score += 0.1;
        evidence.push({ field: "strain", source: "exact", value: candidate.strain, weight: 0.1 });
      }

      if (candidate.weightGrams !== undefined && identity.weightGrams !== undefined) {
        const delta = Math.abs(candidate.weightGrams - identity.weightGrams);
        if (delta <= policy.maxWeightDifferenceGrams) {
          score += 0.1;
          evidence.push({ field: "weightGrams", source: "normalized", value: String(candidate.weightGrams), weight: 0.1 });
        } else {
          score -= 0.25;
        }
      }

      score = Math.max(0, Math.min(1, score));
      const result: ProductEquivalenceResult = {
        candidate,
        canonicalProductId: identity.normalizedProductId,
        equivalent: score >= policy.minimumConfidence,
        confidence: score,
        evidence,
        requiresReview: score >= policy.reviewConfidence && score < policy.minimumConfidence,
      };

      if (!best || result.confidence > best.confidence) best = result;
    }

    return best ?? {
      candidate,
      equivalent: false,
      confidence: 0,
      evidence: [],
      requiresReview: true,
    };
  }
}

export const PRODUCT_EQUIVALENCE_CORE_VERSION = "0.1.0" as const;
