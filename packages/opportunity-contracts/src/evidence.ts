export const OPPORTUNITY_EVIDENCE_TYPES = [
  "market",
  "product",
  "price",
  "competition",
  "demand",
  "supplier",
  "inventory",
  "fulfillment",
  "shipping",
  "ip",
  "platform",
  "economics",
] as const;

export type OpportunityEvidenceType =
  (typeof OPPORTUNITY_EVIDENCE_TYPES)[number];

export type EvidenceConfidence = "low" | "medium" | "high";

export interface EvidenceProvenance {
  provider: string;
  sourceReference?: string;
  retrievalMethod?: string;
}

export interface OpportunityEvidence<T = unknown> {
  id: string;
  opportunityId: string;
  evidenceType: OpportunityEvidenceType;
  observedAt: string;
  retrievedAt: string;
  data: T;
  confidence: EvidenceConfidence;
  freshness?: string;
  provenance: EvidenceProvenance;
}
