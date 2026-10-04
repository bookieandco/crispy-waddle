import type { GrowthId, ISODateTime } from "../domain/types.js";
import type { TikTokMoneyMetric, TikTokNumericMetric } from "./tiktok-shop-intelligence.js";

export type TikTokOfferKind =
  | "discount_percent"
  | "discount_amount"
  | "sale_price"
  | "free_gift"
  | "free_shipping"
  | "low_stock"
  | "limited_time"
  | "other";

export type TikTokOfferState = "active" | "inactive" | "unknown";

export interface TikTokOfferObservation {
  observationId: GrowthId;
  productRef: string;
  offerRef: string;
  kind: TikTokOfferKind;
  displayText: string;
  state: TikTokOfferState;
  percentOff?: TikTokNumericMetric;
  salePrice?: TikTokMoneyMetric;
  validFrom?: ISODateTime;
  validUntil?: ISODateTime;
  sourceRef: string;
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

export type TikTokInvalidOfferAction =
  | "retire_content"
  | "regenerate_without_offer"
  | "manual_review";

export interface TikTokCreativeOfferBinding {
  bindingId: GrowthId;
  contentRef: string;
  productRef: string;
  offerRefs: readonly string[];
  invalidOfferAction: TikTokInvalidOfferAction;
  createdAt: ISODateTime;
}

export interface TikTokCreativeOfferFreshness {
  fresh: boolean;
  action: "keep" | TikTokInvalidOfferAction;
  reasons: readonly string[];
  staleOfferRefs: readonly string[];
}

export function evaluateTikTokCreativeOfferFreshness(input: {
  binding: TikTokCreativeOfferBinding;
  offers: readonly TikTokOfferObservation[];
  now: ISODateTime;
}): TikTokCreativeOfferFreshness {
  assertBinding(input.binding);
  assertTimestamp(input.now, "TIKTOK_OFFER_NOW_INVALID");
  const now = Date.parse(input.now);
  const byRef = new Map(input.offers.map((offer) => {
    assertTikTokOfferObservation(offer);
    return [offer.offerRef, offer] as const;
  }));

  const reasons: string[] = [];
  const staleOfferRefs: string[] = [];

  for (const offerRef of input.binding.offerRefs) {
    const offer = byRef.get(offerRef);
    if (!offer) {
      reasons.push(`TIKTOK_OFFER_EVIDENCE_MISSING:${offerRef}`);
      staleOfferRefs.push(offerRef);
      continue;
    }
    if (offer.productRef !== input.binding.productRef) {
      reasons.push(`TIKTOK_OFFER_PRODUCT_MISMATCH:${offerRef}`);
      staleOfferRefs.push(offerRef);
      continue;
    }
    if (offer.state !== "active") {
      reasons.push(
        offer.state === "unknown"
          ? `TIKTOK_OFFER_STATE_UNKNOWN:${offerRef}`
          : `TIKTOK_OFFER_INACTIVE:${offerRef}`,
      );
      staleOfferRefs.push(offerRef);
      continue;
    }
    if (offer.validFrom && now < Date.parse(offer.validFrom)) {
      reasons.push(`TIKTOK_OFFER_NOT_STARTED:${offerRef}`);
      staleOfferRefs.push(offerRef);
    }
    if (offer.validUntil && now > Date.parse(offer.validUntil)) {
      reasons.push(`TIKTOK_OFFER_EXPIRED:${offerRef}`);
      staleOfferRefs.push(offerRef);
    }
  }

  return Object.freeze({
    fresh: reasons.length === 0,
    action: reasons.length === 0 ? "keep" : input.binding.invalidOfferAction,
    reasons: Object.freeze([...new Set(reasons)]),
    staleOfferRefs: Object.freeze([...new Set(staleOfferRefs)]),
  });
}

export interface TikTokSellerPaidSupportEvidence {
  sellerRef: string;
  lookbackDays: number;
  sampledTopCreativeCount: number;
  paidSupportedTopCreativeCount: number;
  sourceRef: string;
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

export interface TikTokNewReleaseObservation {
  observationId: GrowthId;
  productRef: string;
  sellerRef: string;
  releasedAt?: ISODateTime;
  creatorCount?: TikTokNumericMetric;
  commissionRate?: TikTokNumericMetric;
  sellerRecentGmv?: TikTokMoneyMetric;
  sellerPaidSupport?: TikTokSellerPaidSupportEvidence;
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

export interface TikTokNewReleasePolicy {
  maximumAgeDays: number;
  maximumCreatorCount: number;
  minimumHistoricalPaidSupportShare: number;
  minimumCommissionRate?: number;
}

export interface TikTokNewReleaseDecision {
  qualifiesForTest: boolean;
  reasons: readonly string[];
  ageDays?: number;
  historicalPaidSupportShare?: number;
}

export function evaluateTikTokNewReleaseForTest(input: {
  observation: TikTokNewReleaseObservation;
  policy: TikTokNewReleasePolicy;
  now: ISODateTime;
}): TikTokNewReleaseDecision {
  assertNewReleaseObservation(input.observation);
  assertTimestamp(input.now, "TIKTOK_NEW_RELEASE_NOW_INVALID");
  assertPolicy(input.policy);

  const reasons: string[] = [];
  let ageDays: number | undefined;
  let historicalPaidSupportShare: number | undefined;

  if (!input.observation.releasedAt) {
    reasons.push("TIKTOK_NEW_RELEASE_DATE_UNKNOWN");
  } else {
    ageDays = Math.max(
      0,
      (Date.parse(input.now) - Date.parse(input.observation.releasedAt)) /
        (24 * 60 * 60 * 1000),
    );
    if (ageDays > input.policy.maximumAgeDays) {
      reasons.push("TIKTOK_NEW_RELEASE_TOO_OLD");
    }
  }

  if (!input.observation.creatorCount) {
    reasons.push("TIKTOK_NEW_RELEASE_CREATOR_COUNT_UNKNOWN");
  } else if (
    input.observation.creatorCount.value > input.policy.maximumCreatorCount
  ) {
    reasons.push("TIKTOK_NEW_RELEASE_TOO_SATURATED");
  }

  const paid = input.observation.sellerPaidSupport;
  if (!paid) {
    reasons.push("TIKTOK_NEW_RELEASE_SELLER_PAID_SUPPORT_UNKNOWN");
  } else {
    historicalPaidSupportShare =
      paid.sampledTopCreativeCount > 0
        ? paid.paidSupportedTopCreativeCount / paid.sampledTopCreativeCount
        : 0;
    if (
      historicalPaidSupportShare <
      input.policy.minimumHistoricalPaidSupportShare
    ) {
      reasons.push("TIKTOK_NEW_RELEASE_SELLER_PAID_SUPPORT_LOW");
    }
  }

  if (input.policy.minimumCommissionRate !== undefined) {
    if (!input.observation.commissionRate) {
      reasons.push("TIKTOK_NEW_RELEASE_COMMISSION_UNKNOWN");
    } else if (
      input.observation.commissionRate.value <
      input.policy.minimumCommissionRate
    ) {
      reasons.push("TIKTOK_NEW_RELEASE_COMMISSION_LOW");
    }
  }

  return Object.freeze({
    qualifiesForTest: reasons.length === 0,
    reasons: Object.freeze(reasons),
    ageDays,
    historicalPaidSupportShare,
  });
}

export function assertTikTokOfferObservation(
  observation: TikTokOfferObservation,
): void {
  for (const [field, value] of [
    ["OBSERVATION_ID", observation.observationId],
    ["PRODUCT_REF", observation.productRef],
    ["OFFER_REF", observation.offerRef],
    ["DISPLAY_TEXT", observation.displayText],
    ["SOURCE_REF", observation.sourceRef],
  ] as const) {
    if (!value.trim()) throw new Error(`TIKTOK_OFFER_${field}_REQUIRED`);
  }
  if (!observation.evidenceRefs.length) throw new Error("TIKTOK_OFFER_EVIDENCE_REQUIRED");
  assertTimestamp(observation.observedAt, "TIKTOK_OFFER_OBSERVED_AT_INVALID");
  if (observation.validFrom) assertTimestamp(observation.validFrom, "TIKTOK_OFFER_VALID_FROM_INVALID");
  if (observation.validUntil) assertTimestamp(observation.validUntil, "TIKTOK_OFFER_VALID_UNTIL_INVALID");
  if (
    observation.validFrom &&
    observation.validUntil &&
    Date.parse(observation.validUntil) <= Date.parse(observation.validFrom)
  ) {
    throw new Error("TIKTOK_OFFER_WINDOW_INVALID");
  }
  if (
    observation.percentOff &&
    (!Number.isFinite(observation.percentOff.value) ||
      observation.percentOff.value < 0 ||
      observation.percentOff.value > 1)
  ) {
    throw new Error("TIKTOK_OFFER_PERCENT_INVALID");
  }
  if (
    observation.salePrice &&
    (!Number.isFinite(observation.salePrice.value) ||
      observation.salePrice.value < 0 ||
      !observation.salePrice.currency.trim())
  ) {
    throw new Error("TIKTOK_OFFER_PRICE_INVALID");
  }
}

function assertBinding(binding: TikTokCreativeOfferBinding): void {
  if (!binding.bindingId.trim() || !binding.contentRef.trim() || !binding.productRef.trim()) {
    throw new Error("TIKTOK_OFFER_BINDING_IDENTITY_REQUIRED");
  }
  if (!binding.offerRefs.length) throw new Error("TIKTOK_OFFER_BINDING_REFS_REQUIRED");
  assertTimestamp(binding.createdAt, "TIKTOK_OFFER_BINDING_CREATED_AT_INVALID");
}

function assertNewReleaseObservation(observation: TikTokNewReleaseObservation): void {
  if (!observation.observationId.trim() || !observation.productRef.trim() || !observation.sellerRef.trim()) {
    throw new Error("TIKTOK_NEW_RELEASE_IDENTITY_REQUIRED");
  }
  if (!observation.evidenceRefs.length) throw new Error("TIKTOK_NEW_RELEASE_EVIDENCE_REQUIRED");
  assertTimestamp(observation.observedAt, "TIKTOK_NEW_RELEASE_OBSERVED_AT_INVALID");
  if (observation.releasedAt) assertTimestamp(observation.releasedAt, "TIKTOK_NEW_RELEASE_DATE_INVALID");
  if (observation.creatorCount && (!Number.isFinite(observation.creatorCount.value) || observation.creatorCount.value < 0)) {
    throw new Error("TIKTOK_NEW_RELEASE_CREATOR_COUNT_INVALID");
  }
  if (observation.commissionRate && (
    !Number.isFinite(observation.commissionRate.value) ||
    observation.commissionRate.value < 0 ||
    observation.commissionRate.value > 1
  )) {
    throw new Error("TIKTOK_NEW_RELEASE_COMMISSION_INVALID");
  }
  if (observation.sellerPaidSupport) {
    const paid = observation.sellerPaidSupport;
    if (!paid.sellerRef.trim() || paid.sellerRef !== observation.sellerRef) {
      throw new Error("TIKTOK_NEW_RELEASE_SELLER_SUPPORT_MISMATCH");
    }
    if (!Number.isInteger(paid.sampledTopCreativeCount) || paid.sampledTopCreativeCount < 1) {
      throw new Error("TIKTOK_NEW_RELEASE_SUPPORT_SAMPLE_INVALID");
    }
    if (
      !Number.isInteger(paid.paidSupportedTopCreativeCount) ||
      paid.paidSupportedTopCreativeCount < 0 ||
      paid.paidSupportedTopCreativeCount > paid.sampledTopCreativeCount
    ) {
      throw new Error("TIKTOK_NEW_RELEASE_SUPPORT_COUNT_INVALID");
    }
    if (!paid.evidenceRefs.length || !paid.sourceRef.trim()) {
      throw new Error("TIKTOK_NEW_RELEASE_SUPPORT_EVIDENCE_REQUIRED");
    }
    assertTimestamp(paid.observedAt, "TIKTOK_NEW_RELEASE_SUPPORT_OBSERVED_AT_INVALID");
  }
}

function assertPolicy(policy: TikTokNewReleasePolicy): void {
  if (!Number.isFinite(policy.maximumAgeDays) || policy.maximumAgeDays < 0) {
    throw new Error("TIKTOK_NEW_RELEASE_POLICY_AGE_INVALID");
  }
  if (!Number.isFinite(policy.maximumCreatorCount) || policy.maximumCreatorCount < 0) {
    throw new Error("TIKTOK_NEW_RELEASE_POLICY_CREATORS_INVALID");
  }
  if (
    !Number.isFinite(policy.minimumHistoricalPaidSupportShare) ||
    policy.minimumHistoricalPaidSupportShare < 0 ||
    policy.minimumHistoricalPaidSupportShare > 1
  ) {
    throw new Error("TIKTOK_NEW_RELEASE_POLICY_SUPPORT_INVALID");
  }
  if (
    policy.minimumCommissionRate !== undefined &&
    (!Number.isFinite(policy.minimumCommissionRate) ||
      policy.minimumCommissionRate < 0 ||
      policy.minimumCommissionRate > 1)
  ) {
    throw new Error("TIKTOK_NEW_RELEASE_POLICY_COMMISSION_INVALID");
  }
}

function assertTimestamp(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}
