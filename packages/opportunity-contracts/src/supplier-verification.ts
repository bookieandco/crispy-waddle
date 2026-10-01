export type SupplierVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected"
  | "expired";

export type SupplierRiskLevel = "low" | "medium" | "high" | "critical";

export interface SupplierReference {
  provider: string;
  externalId: string;
  marketplace?: string;
  url?: string;
}

export interface SupplierEvidence {
  evidenceId: string;
  type:
    | "identity"
    | "business"
    | "marketplace"
    | "transaction"
    | "quality"
    | "shipping"
    | "policy"
    | "manual";
  source: string;
  observedAt: string;
  expiresAt?: string;
  summary?: string;
  confidence: number;
}

export interface SupplierRiskAssessment {
  supplierId: string;
  level: SupplierRiskLevel;
  factors: string[];
  evidenceIds: string[];
  assessedAt: string;
}

export interface VerifiedSupplier {
  supplierId: string;
  references: SupplierReference[];
  displayName?: string;
  verificationStatus: SupplierVerificationStatus;
  risk: SupplierRiskAssessment;
  evidence: SupplierEvidence[];
  verifiedAt?: string;
  expiresAt?: string;
}

export interface SupplierVerificationProvider {
  verify(reference: SupplierReference): Promise<VerifiedSupplier>;
  refresh(supplierId: string): Promise<VerifiedSupplier>;
}

export interface SupplierVerificationPolicy {
  minimumStatus: Exclude<SupplierVerificationStatus, "unverified" | "pending">;
  maximumRisk: Exclude<SupplierRiskLevel, "critical">;
  requiredEvidenceTypes?: SupplierEvidence["type"][];
}

export interface SupplierEligibilityResult {
  eligible: boolean;
  supplierId: string;
  reasons: string[];
  checkedAt: string;
}

export interface SupplierEligibilityEvaluator {
  evaluate(
    supplier: VerifiedSupplier,
    policy: SupplierVerificationPolicy,
  ): SupplierEligibilityResult;
}
