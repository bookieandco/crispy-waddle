export type MerchantOnboardingStatus = "draft" | "verification_pending" | "approved" | "restricted" | "suspended" | "rejected";

export interface MerchantProfile {
  merchantId: string;
  legalName: string;
  displayName: string;
  jurisdictionIds: string[];
  status: MerchantOnboardingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantLocation {
  locationId: string;
  merchantId: string;
  name: string;
  jurisdictionId: string;
  deliveryZoneIds: string[];
  timezone: string;
  active: boolean;
}

export interface MerchantLicense {
  licenseId: string;
  merchantId: string;
  jurisdictionId: string;
  licenseType: string;
  status: "pending" | "verified" | "expired" | "revoked";
  expiresAt?: string;
  evidenceIds: string[];
}

export interface MerchantConnection {
  connectionId: string;
  merchantId: string;
  locationId?: string;
  type: "pos" | "inventory" | "payment" | "catalog" | "fleet";
  provider: string;
  status: "pending" | "connected" | "restricted" | "revoked";
  externalAccountId?: string;
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MerchantOnboardingApplication {
  applicationId: string;
  merchant: MerchantProfile;
  locations: MerchantLocation[];
  licenses: MerchantLicense[];
  connections: MerchantConnection[];
  requestedCapabilities: string[];
  policyVersions: Record<string, string>;
}

export interface MerchantOnboardingDecision {
  status: "approved" | "restricted" | "rejected" | "review";
  reasons: string[];
  requiredActions: string[];
  checkedAt: string;
}

export interface MerchantVerificationService {
  verifyLicense(license: MerchantLicense): Promise<{ verified: boolean; evidenceIds: string[] }>;
  verifyLocation(location: MerchantLocation): Promise<{ allowed: boolean; evidenceIds: string[] }>;
}

export interface MerchantConnectionService {
  connect(input: {
    merchantId: string;
    locationId?: string;
    type: MerchantConnection["type"];
    provider: string;
    externalAccountId?: string;
    capabilities: string[];
  }): Promise<MerchantConnection>;
  revoke(connectionId: string, reason: string): Promise<void>;
}

export interface MerchantOnboardingStore {
  save(application: MerchantOnboardingApplication): Promise<void>;
  get(applicationId: string): Promise<MerchantOnboardingApplication | null>;
}

export interface MerchantOnboardingEventSink {
  emit(event: {
    eventId: string;
    applicationId: string;
    merchantId: string;
    type: "MERCHANT_APPLICATION_CREATED" | "MERCHANT_VERIFIED" | "MERCHANT_APPROVED" | "MERCHANT_RESTRICTED" | "MERCHANT_REJECTED" | "MERCHANT_CONNECTION_CHANGED";
    occurredAt: string;
    metadata?: Record<string, string>;
  }): Promise<void>;
}

export class MerchantOnboardingService {
  constructor(
    private readonly store: MerchantOnboardingStore,
    private readonly verification: MerchantVerificationService,
    private readonly events: MerchantOnboardingEventSink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async evaluate(applicationId: string): Promise<MerchantOnboardingDecision> {
    const application = await this.store.get(applicationId);
    if (!application) throw new Error("Merchant onboarding application not found");

    const reasons: string[] = [];
    const requiredActions: string[] = [];

    if (application.locations.length === 0) {
      reasons.push("No merchant location has been supplied");
    }

    for (const license of application.licenses) {
      const result = await this.verification.verifyLicense(license);
      if (!result.verified) {
        reasons.push(`License ${license.licenseId} could not be verified`);
        requiredActions.push(`verify_license:${license.licenseId}`);
      }
    }

    for (const location of application.locations) {
      const result = await this.verification.verifyLocation(location);
      if (!result.allowed) {
        reasons.push(`Location ${location.locationId} is not authorized`);
        requiredActions.push(`review_location:${location.locationId}`);
      }
    }

    const checkedAt = this.now().toISOString();
    const status: MerchantOnboardingDecision["status"] = reasons.length === 0 ? "approved" : "review";

    await this.events.emit({
      eventId: crypto.randomUUID(),
      applicationId,
      merchantId: application.merchant.merchantId,
      type: status === "approved" ? "MERCHANT_APPROVED" : "MERCHANT_RESTRICTED",
      occurredAt: checkedAt,
      metadata: { reasonCount: String(reasons.length) },
    });

    return { status, reasons, requiredActions, checkedAt };
  }
}

export const MERCHANT_ONBOARDING_CORE_VERSION = "0.1.0" as const;
