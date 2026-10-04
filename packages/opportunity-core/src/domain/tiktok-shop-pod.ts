export type TikTokPodEligibilityState = "eligible" | "ineligible" | "unknown";
export type TikTokPodConnectionState = "connected" | "disconnected" | "unknown";
export type TikTokPodTaxState = "ready" | "pending" | "missing" | "unknown";
export type TikTokPodShippingMode =
  | "seller_shipping"
  | "tiktok_shipping"
  | "fulfilled_by_tiktok"
  | "unknown";
export type TikTokPodMadeToOrderState =
  | "enabled"
  | "disabled"
  | "not_available"
  | "unknown";

export interface TikTokPodFulfillmentObservation {
  observationId: string;
  productRef: string;
  providerRef: string;
  merchantRegion: string;
  destinationRegion: string;
  providerRegion: string;
  salesChannelConnection: TikTokPodConnectionState;
  channelEligibility: TikTokPodEligibilityState;
  taxInfoState: TikTokPodTaxState;
  shippingMode: TikTokPodShippingMode;
  madeToOrderState: TikTokPodMadeToOrderState;
  estimatedHandlingBusinessDays?: number;
  maxPermittedHandlingBusinessDays?: number;
  trackingCompatible?: boolean;
  providerSupportsDestination?: boolean;
  sourceRef: string;
  evidenceRefs: readonly string[];
  observedAt: string;
}

export interface TikTokPodListingReadiness {
  ready: boolean;
  reasons: readonly string[];
}

export function assessTikTokPodListingReadiness(
  observation: TikTokPodFulfillmentObservation,
): TikTokPodListingReadiness {
  assertTikTokPodFulfillmentObservation(observation);
  const reasons: string[] = [];

  if (observation.salesChannelConnection !== "connected") {
    reasons.push(
      observation.salesChannelConnection === "unknown"
        ? "TIKTOK_POD_CHANNEL_CONNECTION_UNKNOWN"
        : "TIKTOK_POD_CHANNEL_NOT_CONNECTED",
    );
  }

  if (observation.channelEligibility !== "eligible") {
    reasons.push(
      observation.channelEligibility === "unknown"
        ? "TIKTOK_POD_CHANNEL_ELIGIBILITY_UNKNOWN"
        : "TIKTOK_POD_PRODUCT_INELIGIBLE",
    );
  }

  if (observation.taxInfoState !== "ready") {
    reasons.push(
      observation.taxInfoState === "unknown"
        ? "TIKTOK_POD_TAX_STATE_UNKNOWN"
        : observation.taxInfoState === "pending"
          ? "TIKTOK_POD_TAX_INFO_PENDING"
          : "TIKTOK_POD_TAX_INFO_MISSING",
    );
  }

  if (observation.trackingCompatible !== true) {
    reasons.push(
      observation.trackingCompatible === undefined
        ? "TIKTOK_POD_TRACKING_COMPATIBILITY_UNKNOWN"
        : "TIKTOK_POD_TRACKING_INCOMPATIBLE",
    );
  }

  if (observation.providerSupportsDestination !== true) {
    reasons.push(
      observation.providerSupportsDestination === undefined
        ? "TIKTOK_POD_DESTINATION_SUPPORT_UNKNOWN"
        : "TIKTOK_POD_DESTINATION_UNSUPPORTED",
    );
  }

  if (
    observation.estimatedHandlingBusinessDays === undefined ||
    observation.maxPermittedHandlingBusinessDays === undefined
  ) {
    reasons.push("TIKTOK_POD_HANDLING_WINDOW_UNKNOWN");
  } else if (
    observation.estimatedHandlingBusinessDays >
    observation.maxPermittedHandlingBusinessDays
  ) {
    reasons.push("TIKTOK_POD_HANDLING_WINDOW_EXCEEDED");
  }

  return Object.freeze({
    ready: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

export interface TikTokPodMoneyEvidence {
  value: number;
  currency: string;
  sourceRef: string;
}

export interface TikTokPodRateEvidence {
  value: number;
  sourceRef: string;
}

export interface TikTokPodSellerEconomicsObservation {
  observationId: string;
  productRef: string;
  retailPrice: TikTokPodMoneyEvidence;
  podUnitCost: TikTokPodMoneyEvidence;
  shippingCost: TikTokPodMoneyEvidence;
  effectiveReferralFeeRate?: TikTokPodRateEvidence;
  affiliateCommissionRate?: TikTokPodRateEvidence;
  promotionFeeRate?: TikTokPodRateEvidence;
  sellerFundedDiscount?: TikTokPodMoneyEvidence;
  returnRefundReserve?: TikTokPodMoneyEvidence;
  evidenceRefs: readonly string[];
  observedAt: string;
}

export interface TikTokPodContributionEstimate {
  currency: string;
  grossRevenue: number;
  referralFee?: number;
  affiliateCommission?: number;
  promotionFee?: number;
  podUnitCost: number;
  shippingCost: number;
  sellerFundedDiscount: number;
  returnRefundReserve: number;
  estimatedContribution: number;
  estimatedContributionMargin: number;
}

export function computeTikTokPodContribution(
  observation: TikTokPodSellerEconomicsObservation,
): TikTokPodContributionEstimate {
  assertTikTokPodSellerEconomicsObservation(observation);

  const revenue = observation.retailPrice.value;
  const referralFee =
    observation.effectiveReferralFeeRate === undefined
      ? undefined
      : revenue * observation.effectiveReferralFeeRate.value;
  const affiliateCommission =
    observation.affiliateCommissionRate === undefined
      ? undefined
      : revenue * observation.affiliateCommissionRate.value;
  const promotionFee =
    observation.promotionFeeRate === undefined
      ? undefined
      : revenue * observation.promotionFeeRate.value;
  const sellerFundedDiscount = observation.sellerFundedDiscount?.value ?? 0;
  const returnRefundReserve = observation.returnRefundReserve?.value ?? 0;

  const estimatedContribution =
    revenue -
    observation.podUnitCost.value -
    observation.shippingCost.value -
    (referralFee ?? 0) -
    (affiliateCommission ?? 0) -
    (promotionFee ?? 0) -
    sellerFundedDiscount -
    returnRefundReserve;

  return Object.freeze({
    currency: observation.retailPrice.currency,
    grossRevenue: revenue,
    referralFee,
    affiliateCommission,
    promotionFee,
    podUnitCost: observation.podUnitCost.value,
    shippingCost: observation.shippingCost.value,
    sellerFundedDiscount,
    returnRefundReserve,
    estimatedContribution,
    estimatedContributionMargin: revenue > 0 ? estimatedContribution / revenue : 0,
  });
}

export function assertTikTokPodFulfillmentObservation(
  observation: TikTokPodFulfillmentObservation,
): void {
  for (const [field, value] of [
    ["OBSERVATION_ID", observation.observationId],
    ["PRODUCT_REF", observation.productRef],
    ["PROVIDER_REF", observation.providerRef],
    ["MERCHANT_REGION", observation.merchantRegion],
    ["DESTINATION_REGION", observation.destinationRegion],
    ["PROVIDER_REGION", observation.providerRegion],
    ["SOURCE_REF", observation.sourceRef],
  ] as const) {
    if (!value.trim()) throw new Error(`TIKTOK_POD_${field}_REQUIRED`);
  }
  if (!observation.evidenceRefs.length) {
    throw new Error("TIKTOK_POD_EVIDENCE_REQUIRED");
  }
  assertTimestamp(observation.observedAt, "TIKTOK_POD_OBSERVED_AT_INVALID");

  for (const [field, value] of [
    ["ESTIMATED_HANDLING_DAYS", observation.estimatedHandlingBusinessDays],
    ["MAX_HANDLING_DAYS", observation.maxPermittedHandlingBusinessDays],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 0)
    ) {
      throw new Error(`TIKTOK_POD_${field}_INVALID`);
    }
  }
}

export function assertTikTokPodSellerEconomicsObservation(
  observation: TikTokPodSellerEconomicsObservation,
): void {
  if (!observation.observationId.trim() || !observation.productRef.trim()) {
    throw new Error("TIKTOK_POD_ECONOMICS_IDENTITY_REQUIRED");
  }
  if (!observation.evidenceRefs.length) {
    throw new Error("TIKTOK_POD_ECONOMICS_EVIDENCE_REQUIRED");
  }
  assertTimestamp(observation.observedAt, "TIKTOK_POD_ECONOMICS_OBSERVED_AT_INVALID");

  const money = [
    observation.retailPrice,
    observation.podUnitCost,
    observation.shippingCost,
    observation.sellerFundedDiscount,
    observation.returnRefundReserve,
  ].filter((value): value is TikTokPodMoneyEvidence => value !== undefined);

  const currencies = new Set(money.map((value) => value.currency));
  if (currencies.size !== 1) {
    throw new Error("TIKTOK_POD_ECONOMICS_CURRENCY_MISMATCH");
  }
  for (const value of money) {
    if (!Number.isFinite(value.value) || value.value < 0 || !value.currency.trim() || !value.sourceRef.trim()) {
      throw new Error("TIKTOK_POD_ECONOMICS_MONEY_INVALID");
    }
  }

  for (const rate of [
    observation.effectiveReferralFeeRate,
    observation.affiliateCommissionRate,
    observation.promotionFeeRate,
  ]) {
    if (!rate) continue;
    if (
      !Number.isFinite(rate.value) ||
      rate.value < 0 ||
      rate.value > 1 ||
      !rate.sourceRef.trim()
    ) {
      throw new Error("TIKTOK_POD_ECONOMICS_RATE_INVALID");
    }
  }
}

function assertTimestamp(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}
