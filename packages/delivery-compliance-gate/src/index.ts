export type ComplianceDecision = "allowed" | "denied" | "review";

export interface ComplianceCheckContext {
  orderId: string;
  merchantId: string;
  merchantLocationId: string;
  customerId: string;
  deliveryZoneId: string;
  productIds: string[];
  courierId?: string;
  jurisdictionId: string;
  policyVersion: string;
}

export interface ComplianceFinding {
  code: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  evidenceIds: string[];
}

export interface ComplianceDecisionResult {
  decision: ComplianceDecision;
  policyVersion: string;
  checkedAt: string;
  findings: ComplianceFinding[];
  requiredActions: string[];
  expiresAt?: string;
}

export interface DeliveryCompliancePolicy {
  jurisdictionId: string;
  policyVersion: string;
  deliveryAllowed: boolean;
  requireMerchantLicense: boolean;
  requireDeliveryZoneAuthorization: boolean;
  requireCustomerEligibilityVerification: boolean;
  requireProductEligibilityVerification: boolean;
  requireCourierAuthorization: boolean;
  requireHandoffEvidence: boolean;
  requireDeliveryEvidence: boolean;
}

export interface ComplianceInputs {
  merchant: {
    licensed: boolean;
    licenseId?: string;
    licenseVerifiedAt?: string;
  };
  deliveryZone: {
    allowed: boolean;
    zoneId: string;
  };
  customer: {
    eligible: boolean;
    verificationReference?: string;
    verifiedAt?: string;
  };
  products: Array<{
    productId: string;
    eligible: boolean;
    restrictionCodes?: string[];
  }>;
  courier?: {
    authorized: boolean;
    courierId: string;
    capabilityCodes?: string[];
  };
}

export interface ComplianceEvidenceStore {
  record(input: {
    checkId: string;
    orderId: string;
    type: string;
    payload: Record<string, unknown>;
    occurredAt: string;
  }): Promise<{ evidenceId: string }>;
}

export interface ComplianceEventSink {
  emit(event: {
    eventId: string;
    orderId: string;
    type: "COMPLIANCE_CHECKED" | "DELIVERY_ALLOWED" | "DELIVERY_DENIED" | "COMPLIANCE_REVIEW_REQUIRED";
    occurredAt: string;
    policyVersion: string;
    decision: ComplianceDecision;
    findings: ComplianceFinding[];
  }): Promise<void>;
}

export interface ComplianceGateDeps {
  evidence: ComplianceEvidenceStore;
  events: ComplianceEventSink;
  now?: () => Date;
}

export class DeliveryComplianceGate {
  constructor(private readonly deps: ComplianceGateDeps) {}

  async evaluate(
    context: ComplianceCheckContext,
    policy: DeliveryCompliancePolicy,
    inputs: ComplianceInputs,
  ): Promise<ComplianceDecisionResult> {
    const now = (this.deps.now ?? (() => new Date()))().toISOString();
    const findings: ComplianceFinding[] = [];
    const requiredActions: string[] = [];

    if (context.jurisdictionId !== policy.jurisdictionId) {
      findings.push({
        code: "JURISDICTION_MISMATCH",
        severity: "critical",
        message: "The order jurisdiction does not match the active delivery policy.",
        evidenceIds: [],
      });
    }

    if (!policy.deliveryAllowed) {
      findings.push({
        code: "DELIVERY_NOT_ALLOWED",
        severity: "critical",
        message: "Delivery is disabled by the active jurisdiction policy.",
        evidenceIds: [],
      });
    }

    if (policy.requireMerchantLicense && !inputs.merchant.licensed) {
      findings.push({
        code: "MERCHANT_LICENSE_INVALID",
        severity: "critical",
        message: "Merchant licensing requirements have not been satisfied.",
        evidenceIds: [],
      });
    }

    if (policy.requireDeliveryZoneAuthorization && !inputs.deliveryZone.allowed) {
      findings.push({
        code: "DELIVERY_ZONE_NOT_AUTHORIZED",
        severity: "critical",
        message: "The requested delivery zone is not authorized under the active policy.",
        evidenceIds: [],
      });
    }

    if (policy.requireCustomerEligibilityVerification && !inputs.customer.eligible) {
      findings.push({
        code: "CUSTOMER_ELIGIBILITY_FAILED",
        severity: "critical",
        message: "Customer eligibility verification has not been satisfied.",
        evidenceIds: [],
      });
      requiredActions.push("complete_customer_eligibility_verification");
    }

    for (const product of inputs.products) {
      if (policy.requireProductEligibilityVerification && !product.eligible) {
        findings.push({
          code: "PRODUCT_NOT_ELIGIBLE",
          severity: "critical",
          message: `Product ${product.productId} is not eligible for this delivery under the active policy.`,
          evidenceIds: [],
        });
      }
    }

    if (policy.requireCourierAuthorization && (!inputs.courier || !inputs.courier.authorized)) {
      findings.push({
        code: "COURIER_NOT_AUTHORIZED",
        severity: "critical",
        message: "No authorized courier has been established for this delivery.",
        evidenceIds: [],
      });
      requiredActions.push("assign_authorized_courier");
    }

    const critical = findings.some((finding) => finding.severity === "critical");
    const errors = findings.some((finding) => finding.severity === "error");
    const decision: ComplianceDecision = critical ? "denied" : errors ? "review" : "allowed";

    const evidence = await this.deps.evidence.record({
      checkId: `compliance_${context.orderId}_${policy.policyVersion}`,
      orderId: context.orderId,
      type: "DELIVERY_COMPLIANCE_CHECK",
      payload: { context, policy, inputs, decision, findings },
      occurredAt: now,
    });

    const findingsWithEvidence = findings.map((finding) => ({
      ...finding,
      evidenceIds: [...finding.evidenceIds, evidence.evidenceId],
    }));

    const result: ComplianceDecisionResult = {
      decision,
      policyVersion: policy.policyVersion,
      checkedAt: now,
      findings: findingsWithEvidence,
      requiredActions,
    };

    await this.deps.events.emit({
      eventId: crypto.randomUUID(),
      orderId: context.orderId,
      type:
        decision === "allowed"
          ? "DELIVERY_ALLOWED"
          : decision === "denied"
            ? "DELIVERY_DENIED"
            : "COMPLIANCE_REVIEW_REQUIRED",
      occurredAt: now,
      policyVersion: policy.policyVersion,
      decision,
      findings: findingsWithEvidence,
    });

    return result;
  }
}

export const DELIVERY_COMPLIANCE_GATE_VERSION = "0.1.0" as const;
