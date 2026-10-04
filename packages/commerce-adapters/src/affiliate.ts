export type AffiliateProgramKind =
  | "affiliate"
  | "referral"
  | "creator-payout"
  | "revenue-share"
  | "cashback"
  | "partner-network";

export type AffiliateCommissionType =
  | "recurring"
  | "one-time"
  | "tiered"
  | "hybrid";

export type AffiliateCommissionMode =
  | "percentage"
  | "flat"
  | "tiered"
  | "hybrid"
  | "unknown";

export type AffiliateAttributionModel =
  | "last-click"
  | "first-click"
  | "multi-touch";

export type AffiliateTrackingMethod =
  | "cookie"
  | "server-side"
  | "hybrid";

export type AffiliateApprovalMode =
  | "auto"
  | "manual"
  | "invite-only";

export interface AffiliateCommissionObservation {
  type: AffiliateCommissionType;
  rateText: string;
  mode: AffiliateCommissionMode;
  value?: number;
  currency: string;
  duration?: string;
  conditions?: string;
}

export interface AffiliatePayoutObservation {
  minimum?: number;
  currency?: string;
  frequency?: string;
  methods: string[];
}

export interface AffiliateProgramVerification {
  verified: boolean;
  /**
   * Provider-specific verification scope. For OpenAffiliate this intentionally
   * means affiliate-program-page signals were observed; it does not mean every
   * commission, payout, restriction, or attribution term was independently audited.
   */
  scope: string;
  lastVerifiedAt?: string;
}

export interface AffiliateProgramObservation {
  provider: string;
  sourceId: string;
  programId: string;
  name: string;
  merchantUrl: string;
  signupUrl?: string;
  category: string;
  tags: string[];
  kind: AffiliateProgramKind;
  network?: string;
  commission: AffiliateCommissionObservation;
  cookieDays?: number;
  attribution?: AffiliateAttributionModel;
  trackingMethod?: AffiliateTrackingMethod;
  approval?: AffiliateApprovalMode;
  approvalTime?: string;
  payout?: AffiliatePayoutObservation;
  restrictions: string[];
  verification: AffiliateProgramVerification;
  evidenceRefs: string[];
  observedAt: string;
  metadata?: Record<string, string>;
}

export interface AffiliateProgramDiscoveryQuery {
  query?: string;
  category?: string;
  commissionType?: AffiliateCommissionType;
  verifiedOnly?: boolean;
  limit?: number;
}

export interface AffiliateProgramDiscoveryAdapter {
  readonly name: string;
  search(query: AffiliateProgramDiscoveryQuery): Promise<AffiliateProgramObservation[]>;
  getProgram(programId: string): Promise<AffiliateProgramObservation | null>;
}

export function assertAffiliateProgramObservation(
  program: AffiliateProgramObservation,
): void {
  for (const [field, value] of [
    ["provider", program.provider],
    ["sourceId", program.sourceId],
    ["programId", program.programId],
    ["name", program.name],
    ["merchantUrl", program.merchantUrl],
    ["category", program.category],
    ["commission.rateText", program.commission.rateText],
    ["commission.currency", program.commission.currency],
    ["verification.scope", program.verification.scope],
    ["observedAt", program.observedAt],
  ] as const) {
    if (!value.trim()) throw new Error(`Affiliate program ${field} is required`);
  }

  if (!isHttpUrl(program.merchantUrl)) {
    throw new Error("Affiliate program merchantUrl must be an http(s) URL");
  }
  if (program.signupUrl && !isHttpUrl(program.signupUrl)) {
    throw new Error("Affiliate program signupUrl must be an http(s) URL");
  }
  if (!Number.isFinite(Date.parse(program.observedAt))) {
    throw new Error("Affiliate program observedAt is invalid");
  }
  if (
    program.verification.lastVerifiedAt &&
    !Number.isFinite(Date.parse(program.verification.lastVerifiedAt))
  ) {
    throw new Error("Affiliate program verification timestamp is invalid");
  }
  if (
    program.cookieDays !== undefined &&
    (!Number.isInteger(program.cookieDays) || program.cookieDays < 0)
  ) {
    throw new Error("Affiliate program cookieDays must be a non-negative integer");
  }
  if (
    program.commission.value !== undefined &&
    !Number.isFinite(program.commission.value)
  ) {
    throw new Error("Affiliate program commission value is invalid");
  }
  if (
    program.payout?.minimum !== undefined &&
    (!Number.isFinite(program.payout.minimum) || program.payout.minimum < 0)
  ) {
    throw new Error("Affiliate program payout minimum is invalid");
  }
  if (program.tags.some((value) => !value.trim())) {
    throw new Error("Affiliate program tags cannot contain blank values");
  }
  if (program.restrictions.some((value) => !value.trim())) {
    throw new Error("Affiliate program restrictions cannot contain blank values");
  }
  if (
    program.evidenceRefs.length === 0 ||
    program.evidenceRefs.some((value) => !value.trim())
  ) {
    throw new Error("Affiliate program requires evidence references");
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
