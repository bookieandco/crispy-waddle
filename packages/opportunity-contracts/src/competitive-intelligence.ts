export type CompetitiveEvidenceKind =
  | "observed_fact"
  | "inferred_signal"
  | "model_prediction"
  | "recommended_action";

export interface CompetitiveEvidenceSource {
  sourceId: string;
  sourceType: "marketplace" | "store" | "scraper" | "api" | "manual" | "internal";
  locator: string;
  observedAt: string;
}

export interface CompetitiveEvidence<T = unknown> {
  evidenceId: string;
  kind: CompetitiveEvidenceKind;
  subjectId: string;
  value: T;
  source?: CompetitiveEvidenceSource;
  confidence?: number;
  derivedFromEvidenceIds?: readonly string[];
  modelId?: string;
  createdAt: string;
}

export interface CompetitorObservation {
  competitorId: string;
  productId?: string;
  marketplace?: string;
  listingUrl?: string;
  title?: string;
  priceMinor?: number;
  currency?: string;
  availability?: "available" | "unavailable" | "unknown";
  observedAt: string;
}

export interface CompetitiveIntelligenceQuery {
  productId?: string;
  competitorId?: string;
  marketplace?: string;
  destinationCountry?: string;
}

export interface CompetitiveIntelligenceResult {
  observations: readonly CompetitiveEvidence<CompetitorObservation>[];
  signals: readonly CompetitiveEvidence[];
  predictions: readonly CompetitiveEvidence[];
  recommendations: readonly CompetitiveEvidence[];
}

export interface CompetitiveIntelligenceProvider {
  observe(query: CompetitiveIntelligenceQuery): Promise<CompetitiveIntelligenceResult>;
}

export function isAuthoritativeCompetitiveEvidence(
  evidence: CompetitiveEvidence,
): boolean {
  return evidence.kind === "observed_fact" && evidence.source !== undefined;
}
