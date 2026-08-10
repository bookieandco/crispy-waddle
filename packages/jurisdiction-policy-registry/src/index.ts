export type PolicyStatus = "draft" | "active" | "superseded" | "revoked";

export interface EvidenceReference {
  evidenceId: string;
  sourceType: "statute" | "regulation" | "agency_guidance" | "license_rule" | "official_notice" | "internal_review";
  citation: string;
  sourceUrl?: string;
  retrievedAt: string;
  notes?: string;
}

export interface EffectivePeriod {
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface JurisdictionPolicy {
  policyId: string;
  jurisdictionId: string;
  version: string;
  status: PolicyStatus;
  effective: EffectivePeriod;
  currency: string;
  delivery: {
    allowed: boolean;
    zones: string[];
    merchantLicenseRequired: boolean;
    customerEligibilityRequired: boolean;
    productEligibilityRequired: boolean;
    courierAuthorizationRequired: boolean;
    handoffEvidenceRequired: boolean;
    deliveryEvidenceRequired: boolean;
  };
  payments: {
    providerIds: string[];
    allowedRails: string[];
    sellerOfRecord: "merchant" | "platform";
  };
  evidence: EvidenceReference[];
  supersedes?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface PolicyResolution {
  policy: JurisdictionPolicy;
  resolvedAt: string;
  resolverVersion: string;
}

export interface PolicyRegistry {
  publish(policy: JurisdictionPolicy): Promise<void>;
  get(policyId: string, version?: string): Promise<JurisdictionPolicy | null>;
  resolve(jurisdictionId: string, at: string): Promise<PolicyResolution | null>;
  listActive(at: string): Promise<JurisdictionPolicy[]>;
}

export class InMemoryPolicyRegistry implements PolicyRegistry {
  private readonly policies = new Map<string, JurisdictionPolicy>();

  async publish(policy: JurisdictionPolicy): Promise<void> {
    if (!policy.policyId || !policy.jurisdictionId || !policy.version) {
      throw new Error("Policy requires policyId, jurisdictionId, and version");
    }
    if (policy.status === "active" && policy.evidence.length === 0) {
      throw new Error("An active policy must have at least one evidence reference");
    }
    this.policies.set(`${policy.policyId}@${policy.version}`, structuredClone(policy));
  }

  async get(policyId: string, version?: string): Promise<JurisdictionPolicy | null> {
    if (version) return this.policies.get(`${policyId}@${version}`) ?? null;
    const matches = [...this.policies.values()].filter((p) => p.policyId === policyId);
    return matches.sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
  }

  async resolve(jurisdictionId: string, at: string): Promise<PolicyResolution | null> {
    const timestamp = new Date(at).getTime();
    const candidates = [...this.policies.values()].filter((policy) => {
      if (policy.jurisdictionId !== jurisdictionId || policy.status !== "active") return false;
      const from = new Date(policy.effective.effectiveFrom).getTime();
      const to = policy.effective.effectiveTo ? new Date(policy.effective.effectiveTo).getTime() : Infinity;
      return timestamp >= from && timestamp < to;
    });

    candidates.sort((a, b) => new Date(b.effective.effectiveFrom).getTime() - new Date(a.effective.effectiveFrom).getTime());
    const policy = candidates[0];
    if (!policy) return null;

    return {
      policy: structuredClone(policy),
      resolvedAt: at,
      resolverVersion: POLICY_REGISTRY_VERSION,
    };
  }

  async listActive(at: string): Promise<JurisdictionPolicy[]> {
    const timestamp = new Date(at).getTime();
    return [...this.policies.values()].filter((policy) => {
      if (policy.status !== "active") return false;
      const from = new Date(policy.effective.effectiveFrom).getTime();
      const to = policy.effective.effectiveTo ? new Date(policy.effective.effectiveTo).getTime() : Infinity;
      return timestamp >= from && timestamp < to;
    }).map(structuredClone);
  }
}

export interface PolicyApprovalService {
  approve(input: {
    policyId: string;
    version: string;
    approverId: string;
    evidence: EvidenceReference[];
  }): Promise<{ approvedAt: string }>;
}

export const POLICY_REGISTRY_VERSION = "0.1.0" as const;
