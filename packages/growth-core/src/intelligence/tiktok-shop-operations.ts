import type { GrowthId, ISODateTime } from "../domain/types.js";
import type { TikTokMoneyMetric } from "./tiktok-shop-intelligence.js";

export type TikTokCreatorType = "affiliate" | "marketing" | "official" | "unknown";
export type TikTokPilotState =
  | "none"
  | "early_stage"
  | "affiliate_pilot"
  | "extended_pilot"
  | "unknown";

export interface TikTokShopCapabilityObservation {
  observationId: GrowthId;
  accountRef: string;
  region: string;
  creatorType: TikTokCreatorType;
  pilotState: TikTokPilotState;
  dailyShoppableVideoLimit?: number;
  weeklyShoppableLiveLimit?: number;
  campaignEligible?: boolean;
  productMarketplaceEligible?: boolean;
  creatorHealthRating?: number;
  sourceRef: string;
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

export interface TikTokPublishingUsage {
  shoppableVideosToday: number;
  shoppableLivesThisWeek: number;
}

export interface TikTokPublishingAllowance {
  canPublishShoppableVideo: boolean;
  canStartShoppableLive: boolean;
  remainingShoppableVideos?: number;
  remainingShoppableLives?: number;
  reasons: readonly string[];
}

export function computeTikTokPublishingAllowance(
  capability: TikTokShopCapabilityObservation,
  usage: TikTokPublishingUsage,
): TikTokPublishingAllowance {
  assertTikTokShopCapabilityObservation(capability);
  for (const [field, value] of [
    ["VIDEOS_TODAY", usage.shoppableVideosToday],
    ["LIVES_THIS_WEEK", usage.shoppableLivesThisWeek],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`TIKTOK_USAGE_${field}_INVALID`);
    }
  }

  const reasons: string[] = [];
  const videoLimit = capability.dailyShoppableVideoLimit;
  const liveLimit = capability.weeklyShoppableLiveLimit;
  if (videoLimit === undefined) reasons.push("TIKTOK_SHOPPABLE_VIDEO_LIMIT_UNKNOWN");
  if (liveLimit === undefined) reasons.push("TIKTOK_SHOPPABLE_LIVE_LIMIT_UNKNOWN");

  const remainingShoppableVideos =
    videoLimit === undefined ? undefined : Math.max(0, videoLimit - usage.shoppableVideosToday);
  const remainingShoppableLives =
    liveLimit === undefined ? undefined : Math.max(0, liveLimit - usage.shoppableLivesThisWeek);

  if (remainingShoppableVideos === 0) reasons.push("TIKTOK_SHOPPABLE_VIDEO_LIMIT_REACHED");
  if (remainingShoppableLives === 0) reasons.push("TIKTOK_SHOPPABLE_LIVE_LIMIT_REACHED");

  return Object.freeze({
    canPublishShoppableVideo:
      remainingShoppableVideos !== undefined && remainingShoppableVideos > 0,
    canStartShoppableLive:
      remainingShoppableLives !== undefined && remainingShoppableLives > 0,
    remainingShoppableVideos,
    remainingShoppableLives,
    reasons: Object.freeze(reasons),
  });
}

export interface TikTokCampaignWindowObservation {
  observationId: GrowthId;
  campaignRef: string;
  name: string;
  region: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  sourceRef: string;
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

export type TikTokCampaignTimingState =
  | "too_early"
  | "preheat"
  | "active"
  | "ended";

export function classifyTikTokCampaignTiming(input: {
  campaign: TikTokCampaignWindowObservation;
  now: ISODateTime;
  preheatDays: number;
}): TikTokCampaignTimingState {
  assertTikTokCampaignWindowObservation(input.campaign);
  assertTimestamp(input.now, "TIKTOK_CAMPAIGN_NOW_INVALID");
  if (!Number.isInteger(input.preheatDays) || input.preheatDays < 0 || input.preheatDays > 90) {
    throw new Error("TIKTOK_CAMPAIGN_PREHEAT_DAYS_INVALID");
  }

  const now = Date.parse(input.now);
  const start = Date.parse(input.campaign.startsAt);
  const end = Date.parse(input.campaign.endsAt);
  if (now > end) return "ended";
  if (now >= start) return "active";
  const preheatStart = start - input.preheatDays * 24 * 60 * 60 * 1000;
  return now >= preheatStart ? "preheat" : "too_early";
}

export type TikTokCommerceFunnelStage = "top" | "middle" | "bottom";

export interface TikTokFunnelCreativeBrief {
  briefId: GrowthId;
  productRef: string;
  stage: TikTokCommerceFunnelStage;
  audienceAwareness:
    | "cold"
    | "problem_aware"
    | "product_aware"
    | "ready_to_buy";
  hookClass:
    | "problem"
    | "demonstration"
    | "comparison"
    | "offer"
    | "bundle"
    | "gift"
    | "seasonal"
    | "other";
  requiredClaimRefs: readonly string[];
  offerEvidenceRefs: readonly string[];
  createdAt: ISODateTime;
}

export interface TikTokGmvMaxEvidenceObservation {
  observationId: GrowthId;
  productRef: string;
  shopRef?: string;
  contentRef?: string;
  affiliateCreativeAuthorized?: boolean;
  observedInShopAds?: boolean;
  observedInGmvMax?: boolean;
  attributedAdGmv?: TikTokMoneyMetric;
  attributedOrganicGmv?: TikTokMoneyMetric;
  sourceRef: string;
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

/**
 * GMV Max evidence deliberately does not contain an inferred seller ad budget.
 * An observed/authorized creative is evidence of ad participation, not proof of
 * the advertiser's total spend or a guarantee that future spend will be allocated.
 */
export function assertTikTokGmvMaxEvidenceObservation(
  observation: TikTokGmvMaxEvidenceObservation,
): void {
  if (!observation.observationId.trim()) throw new Error("TIKTOK_GMV_MAX_OBSERVATION_ID_REQUIRED");
  if (!observation.productRef.trim()) throw new Error("TIKTOK_GMV_MAX_PRODUCT_REF_REQUIRED");
  if (!observation.sourceRef.trim()) throw new Error("TIKTOK_GMV_MAX_SOURCE_REF_REQUIRED");
  if (!observation.evidenceRefs.length) throw new Error("TIKTOK_GMV_MAX_EVIDENCE_REQUIRED");
  assertTimestamp(observation.observedAt, "TIKTOK_GMV_MAX_OBSERVED_AT_INVALID");
  for (const metric of [observation.attributedAdGmv, observation.attributedOrganicGmv]) {
    if (metric) {
      if (!Number.isFinite(metric.value) || metric.value < 0) {
        throw new Error("TIKTOK_GMV_MAX_GMV_INVALID");
      }
      if (!metric.currency.trim()) throw new Error("TIKTOK_GMV_MAX_CURRENCY_REQUIRED");
    }
  }
}

export interface TikTokLiveCommerceObservation {
  observationId: GrowthId;
  sessionRef: string;
  productRef: string;
  durationSeconds: number;
  uniqueViewers?: number;
  averageWatchSeconds?: number;
  basketClicks?: number;
  orders?: number;
  attributedRevenue?: TikTokMoneyMetric;
  commissionEarned?: TikTokMoneyMetric;
  billboardUsed?: boolean;
  scriptRef?: string;
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

export interface TikTokLiveCommerceMetrics {
  basketClickRate?: number;
  orderConversionRate?: number;
  revenuePerLiveHour?: number;
  commissionPerLiveHour?: number;
  currency?: string;
}

export function computeTikTokLiveCommerceMetrics(
  observation: TikTokLiveCommerceObservation,
): TikTokLiveCommerceMetrics {
  assertTikTokLiveCommerceObservation(observation);
  const basketClickRate =
    observation.uniqueViewers !== undefined &&
    observation.uniqueViewers > 0 &&
    observation.basketClicks !== undefined
      ? observation.basketClicks / observation.uniqueViewers
      : undefined;
  const orderConversionRate =
    observation.basketClicks !== undefined &&
    observation.basketClicks > 0 &&
    observation.orders !== undefined
      ? observation.orders / observation.basketClicks
      : undefined;
  const hours = observation.durationSeconds / 3600;

  let revenuePerLiveHour: number | undefined;
  let commissionPerLiveHour: number | undefined;
  let currency: string | undefined;

  if (observation.attributedRevenue) {
    revenuePerLiveHour = observation.attributedRevenue.value / hours;
    currency = observation.attributedRevenue.currency;
  }
  if (observation.commissionEarned) {
    if (currency && currency !== observation.commissionEarned.currency) {
      throw new Error("TIKTOK_LIVE_CURRENCY_MISMATCH");
    }
    commissionPerLiveHour = observation.commissionEarned.value / hours;
    currency = observation.commissionEarned.currency;
  }

  return Object.freeze({
    basketClickRate,
    orderConversionRate,
    revenuePerLiveHour,
    commissionPerLiveHour,
    currency,
  });
}

export function assertTikTokShopCapabilityObservation(
  observation: TikTokShopCapabilityObservation,
): void {
  for (const [field, value] of [
    ["OBSERVATION_ID", observation.observationId],
    ["ACCOUNT_REF", observation.accountRef],
    ["REGION", observation.region],
    ["SOURCE_REF", observation.sourceRef],
  ] as const) {
    if (!value.trim()) throw new Error(`TIKTOK_CAPABILITY_${field}_REQUIRED`);
  }
  if (!observation.evidenceRefs.length) throw new Error("TIKTOK_CAPABILITY_EVIDENCE_REQUIRED");
  assertTimestamp(observation.observedAt, "TIKTOK_CAPABILITY_OBSERVED_AT_INVALID");
  for (const [field, value] of [
    ["VIDEO_LIMIT", observation.dailyShoppableVideoLimit],
    ["LIVE_LIMIT", observation.weeklyShoppableLiveLimit],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`TIKTOK_CAPABILITY_${field}_INVALID`);
    }
  }
  if (
    observation.creatorHealthRating !== undefined &&
    (!Number.isFinite(observation.creatorHealthRating) ||
      observation.creatorHealthRating < 0)
  ) {
    throw new Error("TIKTOK_CAPABILITY_HEALTH_RATING_INVALID");
  }
}

export function assertTikTokCampaignWindowObservation(
  observation: TikTokCampaignWindowObservation,
): void {
  if (!observation.observationId.trim() || !observation.campaignRef.trim() || !observation.name.trim()) {
    throw new Error("TIKTOK_CAMPAIGN_IDENTITY_REQUIRED");
  }
  if (!observation.region.trim() || !observation.sourceRef.trim()) {
    throw new Error("TIKTOK_CAMPAIGN_SOURCE_REQUIRED");
  }
  if (!observation.evidenceRefs.length) throw new Error("TIKTOK_CAMPAIGN_EVIDENCE_REQUIRED");
  assertTimestamp(observation.startsAt, "TIKTOK_CAMPAIGN_START_INVALID");
  assertTimestamp(observation.endsAt, "TIKTOK_CAMPAIGN_END_INVALID");
  assertTimestamp(observation.observedAt, "TIKTOK_CAMPAIGN_OBSERVED_AT_INVALID");
  if (observation.endsAt <= observation.startsAt) throw new Error("TIKTOK_CAMPAIGN_RANGE_INVALID");
}

export function assertTikTokLiveCommerceObservation(
  observation: TikTokLiveCommerceObservation,
): void {
  if (!observation.observationId.trim() || !observation.sessionRef.trim() || !observation.productRef.trim()) {
    throw new Error("TIKTOK_LIVE_IDENTITY_REQUIRED");
  }
  if (!Number.isFinite(observation.durationSeconds) || observation.durationSeconds <= 0) {
    throw new Error("TIKTOK_LIVE_DURATION_INVALID");
  }
  for (const [field, value] of [
    ["UNIQUE_VIEWERS", observation.uniqueViewers],
    ["BASKET_CLICKS", observation.basketClicks],
    ["ORDERS", observation.orders],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`TIKTOK_LIVE_${field}_INVALID`);
    }
  }
  if (
    observation.averageWatchSeconds !== undefined &&
    (!Number.isFinite(observation.averageWatchSeconds) ||
      observation.averageWatchSeconds < 0)
  ) {
    throw new Error("TIKTOK_LIVE_AVERAGE_WATCH_INVALID");
  }
  if (!observation.evidenceRefs.length) throw new Error("TIKTOK_LIVE_EVIDENCE_REQUIRED");
  assertTimestamp(observation.observedAt, "TIKTOK_LIVE_OBSERVED_AT_INVALID");
}

function assertTimestamp(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}
