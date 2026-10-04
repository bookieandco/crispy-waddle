import type { Opportunity } from "./opportunity.js";
import {
  recordSideHustleAffiliateEvent,
  type SideHustleAffiliateEvent,
  type SideHustleAffiliateEconomicState,
} from "./side-hustle-commerce.js";

export type TikTokAffiliateOrderObservation = {
  id: string;
  opportunityId: string;
  programRef: string;
  affiliateOrderId: string;
  productRef: string;
  creatorAccountRef: string;
  providerStatus: string;
  economicState: SideHustleAffiliateEconomicState;
  commissionAmount: number;
  currency: string;
  attributedAt: string;
  sourceRef: string;
  evidenceRefs: readonly string[];
};

export type TikTokAffiliatePayoutObservation = {
  id: string;
  opportunityId: string;
  programRef: string;
  payoutId: string;
  affiliateOrderId: string;
  conversionExternalRef: string;
  creatorAccountRef: string;
  providerStatus: string;
  amount: number;
  currency: string;
  paidAt: string;
  sourceRef: string;
  evidenceRefs: readonly string[];
  sourceKind:
    | "creator_finance_export"
    | "affiliate_settlement_report"
    | "authorized_affiliate_api";
};

export function recordTikTokAffiliateConversion(input: {
  opportunity: Opportunity;
  observation: TikTokAffiliateOrderObservation;
}): SideHustleAffiliateEvent {
  const observation = assertOrder(input.observation);
  if (observation.opportunityId !== input.opportunity.id) {
    throw new Error("TIKTOK_AFFILIATE_ORDER_OPPORTUNITY_MISMATCH");
  }
  return recordSideHustleAffiliateEvent({
    opportunity: input.opportunity,
    id: observation.id,
    programRef: observation.programRef,
    providerRef: "provider:tiktok-shop-affiliate",
    externalEventRef: `tiktok:affiliate-order:${observation.affiliateOrderId}`,
    kind: "conversion",
    providerStatus: observation.providerStatus,
    economicState: observation.economicState,
    customerOrSessionRef: observation.creatorAccountRef,
    amount: observation.commissionAmount,
    currency: observation.currency,
    metadata: {
      product_ref: observation.productRef,
      affiliate_order_id: observation.affiliateOrderId,
      source_kind: "authorized_affiliate_order",
      source_ref: observation.sourceRef,
    },
    evidenceRefs: [...observation.evidenceRefs, observation.sourceRef],
    occurredAt: observation.attributedAt,
  });
}

export function recordTikTokAffiliatePaidPayout(input: {
  opportunity: Opportunity;
  observation: TikTokAffiliatePayoutObservation;
}): SideHustleAffiliateEvent {
  const observation = assertPayout(input.observation);
  if (observation.opportunityId !== input.opportunity.id) {
    throw new Error("TIKTOK_AFFILIATE_PAYOUT_OPPORTUNITY_MISMATCH");
  }
  if (observation.providerStatus.trim().toLowerCase() !== "paid") {
    throw new Error("TIKTOK_AFFILIATE_PAYOUT_REQUIRES_PAID_PROVIDER_STATE");
  }
  return recordSideHustleAffiliateEvent({
    opportunity: input.opportunity,
    id: observation.id,
    programRef: observation.programRef,
    providerRef: "provider:tiktok-shop-affiliate",
    externalEventRef: `tiktok:affiliate-payout:${observation.payoutId}`,
    kind: "payout",
    providerStatus: observation.providerStatus,
    economicState: "paid",
    customerOrSessionRef: observation.creatorAccountRef,
    amount: observation.amount,
    currency: observation.currency,
    metadata: {
      settlement_basis: "tiktok_creator_paid_payout_no_fx",
      conversion_external_ref: observation.conversionExternalRef,
      conversion_id: observation.affiliateOrderId,
      conversion_at: observation.paidAt,
      affiliate_order_id: observation.affiliateOrderId,
      payout_id: observation.payoutId,
      source_kind: observation.sourceKind,
      source_ref: observation.sourceRef,
    },
    evidenceRefs: [...observation.evidenceRefs, observation.sourceRef],
    occurredAt: observation.paidAt,
  });
}

function assertOrder(
  observation: TikTokAffiliateOrderObservation,
): TikTokAffiliateOrderObservation {
  requireIdentity([
    observation.id,
    observation.opportunityId,
    observation.programRef,
    observation.affiliateOrderId,
    observation.productRef,
    observation.creatorAccountRef,
    observation.providerStatus,
    observation.sourceRef,
  ], "TIKTOK_AFFILIATE_ORDER_IDENTITY_REQUIRED");
  requireMoney(observation.commissionAmount, observation.currency);
  requireDate(observation.attributedAt, "TIKTOK_AFFILIATE_ORDER_DATE_INVALID");
  requireEvidence(observation.evidenceRefs, "TIKTOK_AFFILIATE_ORDER_EVIDENCE_REQUIRED");
  return {
    ...observation,
    currency: observation.currency.trim().toUpperCase(),
    evidenceRefs: unique(observation.evidenceRefs),
  };
}

function assertPayout(
  observation: TikTokAffiliatePayoutObservation,
): TikTokAffiliatePayoutObservation {
  requireIdentity([
    observation.id,
    observation.opportunityId,
    observation.programRef,
    observation.payoutId,
    observation.affiliateOrderId,
    observation.conversionExternalRef,
    observation.creatorAccountRef,
    observation.providerStatus,
    observation.sourceRef,
  ], "TIKTOK_AFFILIATE_PAYOUT_IDENTITY_REQUIRED");
  requireMoney(observation.amount, observation.currency);
  requireDate(observation.paidAt, "TIKTOK_AFFILIATE_PAYOUT_DATE_INVALID");
  requireEvidence(observation.evidenceRefs, "TIKTOK_AFFILIATE_PAYOUT_EVIDENCE_REQUIRED");
  return {
    ...observation,
    currency: observation.currency.trim().toUpperCase(),
    evidenceRefs: unique(observation.evidenceRefs),
  };
}

function requireMoney(amount: number, currency: string): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("TIKTOK_AFFILIATE_AMOUNT_MUST_BE_POSITIVE");
  }
  if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
    throw new Error("TIKTOK_AFFILIATE_CURRENCY_INVALID");
  }
}

function requireIdentity(values: readonly string[], code: string): void {
  if (values.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error(code);
  }
}

function requireEvidence(values: readonly string[], code: string): void {
  if (!values.length || values.some((value) => !value.trim())) throw new Error(code);
}

function requireDate(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
