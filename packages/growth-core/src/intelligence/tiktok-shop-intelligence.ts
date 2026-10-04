import type { GrowthId, ISODateTime } from "../domain/types.js";

export type TikTokShopObservationSource =
  | "tiktok_shop"
  | "tiktok_business"
  | "shopshark"
  | "manual"
  | (string & {});

export type TikTokMetricProvenance =
  | "observed"
  | "provider_reported"
  | "provider_estimated"
  | "user_reported";

export interface TikTokNumericMetric {
  value: number;
  provenance: TikTokMetricProvenance;
  sourceRef?: string;
}

export interface TikTokMoneyMetric extends TikTokNumericMetric {
  currency: string;
}

export type TikTokCommerceLane =
  | "seller_acquisition"
  | "affiliate_commission";

export type TikTokTrendState =
  | "rising"
  | "flat"
  | "declining"
  | "unknown";

export type TikTokDemandDistribution =
  | "diversified"
  | "mixed"
  | "creator_concentrated"
  | "unknown";

export interface TikTokCreatorProductContribution {
  creatorRef: string;
  attributedGmv?: TikTokMoneyMetric;
  attributedUnits?: TikTokNumericMetric;
  evidenceRefs: readonly string[];
}

export interface TikTokShopProductObservation {
  observationId: GrowthId;
  source: TikTokShopObservationSource;
  provider: string;
  productRef: string;
  productName: string;
  shopRef?: string;
  category?: string;
  listingUrl?: string;

  price: TikTokMoneyMetric;
  unitsSold?: TikTokNumericMetric;
  gmv?: TikTokMoneyMetric;
  weeklyGmvGrowthRate?: TikTokNumericMetric;
  reviewCount?: TikTokNumericMetric;
  creatorCount?: TikTokNumericMetric;
  shoppableContentCount?: TikTokNumericMetric;
  sellerCount?: TikTokNumericMetric;
  commissionRate?: TikTokNumericMetric;
  commissionValuePerOrder?: TikTokMoneyMetric;
  adSupportedCreativeCount?: TikTokNumericMetric;
  liveSalesEventCount?: TikTokNumericMetric;

  listedAt?: ISODateTime;
  creatorContributions: readonly TikTokCreatorProductContribution[];
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

export interface TikTokCreatorConcentrationThresholds {
  diversifiedMinimumCreators: number;
  diversifiedMaximumTopShare: number;
  diversifiedMaximumHhi: number;
  concentratedMinimumTopShare: number;
  concentratedMinimumHhi: number;
}

export const DEFAULT_TIKTOK_CREATOR_CONCENTRATION_THRESHOLDS: TikTokCreatorConcentrationThresholds =
  Object.freeze({
    diversifiedMinimumCreators: 3,
    diversifiedMaximumTopShare: 0.5,
    diversifiedMaximumHhi: 0.35,
    concentratedMinimumTopShare: 0.65,
    concentratedMinimumHhi: 0.5,
  });

export interface TikTokCreatorConcentration {
  contributingCreatorCount: number;
  measuredCreatorCount: number;
  topCreatorShare?: number;
  hhi?: number;
  distribution: TikTokDemandDistribution;
  evidenceRefs: readonly string[];
}

export function assessTikTokCreatorConcentration(
  contributions: readonly TikTokCreatorProductContribution[],
  thresholds: TikTokCreatorConcentrationThresholds =
    DEFAULT_TIKTOK_CREATOR_CONCENTRATION_THRESHOLDS,
): TikTokCreatorConcentration {
  assertCreatorConcentrationThresholds(thresholds);

  const measured = contributions
    .map((contribution) => ({
      contribution,
      value: contribution.attributedGmv?.value,
    }))
    .filter(
      (
        item,
      ): item is {
        contribution: TikTokCreatorProductContribution;
        value: number;
      } =>
        item.value !== undefined &&
        Number.isFinite(item.value) &&
        item.value >= 0,
    );

  const evidenceRefs = Object.freeze([
    ...new Set(
      measured.flatMap((item) => item.contribution.evidenceRefs).filter(Boolean),
    ),
  ]);

  const positive = measured.filter((item) => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);

  if (positive.length === 0 || total <= 0) {
    return Object.freeze({
      contributingCreatorCount: positive.length,
      measuredCreatorCount: measured.length,
      distribution: "unknown" as const,
      evidenceRefs,
    });
  }

  const shares = positive.map((item) => item.value / total);
  const topCreatorShare = Math.max(...shares);
  const hhi = shares.reduce((sum, share) => sum + share * share, 0);

  let distribution: TikTokDemandDistribution = "mixed";
  if (
    positive.length >= thresholds.diversifiedMinimumCreators &&
    topCreatorShare <= thresholds.diversifiedMaximumTopShare &&
    hhi <= thresholds.diversifiedMaximumHhi
  ) {
    distribution = "diversified";
  } else if (
    topCreatorShare >= thresholds.concentratedMinimumTopShare ||
    hhi >= thresholds.concentratedMinimumHhi
  ) {
    distribution = "creator_concentrated";
  }

  return Object.freeze({
    contributingCreatorCount: positive.length,
    measuredCreatorCount: measured.length,
    topCreatorShare,
    hhi,
    distribution,
    evidenceRefs,
  });
}

export interface TikTokProductTrendThresholds {
  risingMinimumWeeklyGrowthRate: number;
  decliningMaximumWeeklyGrowthRate: number;
}

export const DEFAULT_TIKTOK_PRODUCT_TREND_THRESHOLDS: TikTokProductTrendThresholds =
  Object.freeze({
    risingMinimumWeeklyGrowthRate: 0.05,
    decliningMaximumWeeklyGrowthRate: -0.05,
  });

export function classifyTikTokProductTrend(
  weeklyGmvGrowthRate: TikTokNumericMetric | undefined,
  thresholds: TikTokProductTrendThresholds =
    DEFAULT_TIKTOK_PRODUCT_TREND_THRESHOLDS,
): TikTokTrendState {
  if (!weeklyGmvGrowthRate) return "unknown";
  assertMetric(weeklyGmvGrowthRate, "WEEKLY_GMV_GROWTH_RATE", {
    allowNegative: true,
  });
  if (
    !Number.isFinite(thresholds.risingMinimumWeeklyGrowthRate) ||
    !Number.isFinite(thresholds.decliningMaximumWeeklyGrowthRate) ||
    thresholds.decliningMaximumWeeklyGrowthRate >=
      thresholds.risingMinimumWeeklyGrowthRate
  ) {
    throw new Error("TIKTOK_TREND_THRESHOLDS_INVALID");
  }

  if (weeklyGmvGrowthRate.value >= thresholds.risingMinimumWeeklyGrowthRate) {
    return "rising";
  }
  if (weeklyGmvGrowthRate.value <= thresholds.decliningMaximumWeeklyGrowthRate) {
    return "declining";
  }
  return "flat";
}

export interface TikTokSellerEconomics {
  landedUnitCost: TikTokMoneyMetric;
  expectedCreatorCommissionRate?: number;
  expectedPlatformFeeRate?: number;
  expectedReturnReserveRate?: number;
}

export interface TikTokAffiliateEconomics {
  commissionRate?: number;
  commissionValuePerOrder?: TikTokMoneyMetric;
}

export interface TikTokLaneClassification {
  lane: TikTokCommerceLane;
  rationale: string;
}

export function classifyTikTokCommerceLane(input: {
  ownsInventory: boolean;
  sellerEconomics?: TikTokSellerEconomics;
  affiliateEconomics?: TikTokAffiliateEconomics;
}): TikTokLaneClassification {
  if (input.ownsInventory) {
    if (!input.sellerEconomics) {
      throw new Error("TIKTOK_SELLER_ECONOMICS_REQUIRED");
    }
    assertMoneyMetric(input.sellerEconomics.landedUnitCost, "LANDED_UNIT_COST");
    return Object.freeze({
      lane: "seller_acquisition" as const,
      rationale:
        "Inventory is owned, so product selection must optimize contribution margin, creator economics, and downstream customer value.",
    });
  }

  if (!input.affiliateEconomics) {
    throw new Error("TIKTOK_AFFILIATE_ECONOMICS_REQUIRED");
  }
  if (
    input.affiliateEconomics.commissionRate === undefined &&
    input.affiliateEconomics.commissionValuePerOrder === undefined
  ) {
    throw new Error("TIKTOK_AFFILIATE_COMMISSION_REQUIRED");
  }
  if (input.affiliateEconomics.commissionRate !== undefined) {
    assertRate(
      input.affiliateEconomics.commissionRate,
      "TIKTOK_AFFILIATE_COMMISSION_RATE_INVALID",
    );
  }
  if (input.affiliateEconomics.commissionValuePerOrder) {
    assertMoneyMetric(
      input.affiliateEconomics.commissionValuePerOrder,
      "AFFILIATE_COMMISSION_VALUE",
    );
  }

  return Object.freeze({
    lane: "affiliate_commission" as const,
    rationale:
      "No owned inventory is being risked, so the lane optimizes attributable commission, conversion evidence, and reversal-adjusted payout.",
  });
}

export type TikTokCreativeFormat =
  | "faceless_product_demo"
  | "ai_slideshow"
  | "ai_video"
  | "ai_influencer"
  | "on_camera"
  | "live"
  | "other";

export interface TikTokProductCompetitionMetrics {
  gmvPerObservedCreator?: number;
  gmvPerObservedShoppableContent?: number;
}

export function computeTikTokProductCompetitionMetrics(
  observation: TikTokShopProductObservation,
): TikTokProductCompetitionMetrics {
  assertTikTokShopProductObservation(observation);
  const gmv = observation.gmv?.value;
  return Object.freeze({
    gmvPerObservedCreator:
      gmv !== undefined &&
      observation.creatorCount !== undefined &&
      observation.creatorCount.value > 0
        ? gmv / observation.creatorCount.value
        : undefined,
    gmvPerObservedShoppableContent:
      gmv !== undefined &&
      observation.shoppableContentCount !== undefined &&
      observation.shoppableContentCount.value > 0
        ? gmv / observation.shoppableContentCount.value
        : undefined,
  });
}

export type TikTokOpportunityLabel =
  | "low_stock_keyword"
  | "trending_keyword"
  | "fast_growing_keyword"
  | "hot_selling_keyword"
  | "other";

export interface TikTokShopSearchOpportunityObservation {
  observationId: GrowthId;
  query: string;
  region: string;
  category?: string;
  searchDemand?: TikTokNumericMetric;
  competingProductCount?: TikTokNumericMetric;
  label?: TikTokOpportunityLabel;
  sourceRef: string;
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

export interface TikTokSearchOpportunityMetrics {
  demandPerCompetingProduct?: number;
}

export function computeTikTokSearchOpportunityMetrics(
  observation: TikTokShopSearchOpportunityObservation,
): TikTokSearchOpportunityMetrics {
  if (!observation.observationId.trim() || !observation.query.trim() || !observation.region.trim()) {
    throw new Error("TIKTOK_SEARCH_OPPORTUNITY_IDENTITY_REQUIRED");
  }
  if (!observation.sourceRef.trim() || !observation.evidenceRefs.length) {
    throw new Error("TIKTOK_SEARCH_OPPORTUNITY_EVIDENCE_REQUIRED");
  }
  assertTimestamp(observation.observedAt, "TIKTOK_SEARCH_OPPORTUNITY_OBSERVED_AT_INVALID");
  assertOptionalMetric(observation.searchDemand, "SEARCH_DEMAND");
  assertOptionalMetric(observation.competingProductCount, "COMPETING_PRODUCT_COUNT");

  return Object.freeze({
    demandPerCompetingProduct:
      observation.searchDemand !== undefined &&
      observation.competingProductCount !== undefined &&
      observation.competingProductCount.value > 0
        ? observation.searchDemand.value / observation.competingProductCount.value
        : undefined,
  });
}

export interface TikTokCreativeCommerceObservation {
  observationId: GrowthId;
  productRef: string;
  contentRef: string;
  format: TikTokCreativeFormat;
  views: number;
  productClicks?: number;
  orders?: number;
  attributedRevenue?: TikTokMoneyMetric;
  commissionEarned?: TikTokMoneyMetric;
  contentCost?: TikTokMoneyMetric;
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

export interface TikTokCreativeCommerceMetrics {
  productClickRate?: number;
  orderConversionRate?: number;
  ordersPerThousandViews?: number;
  commissionPerThousandViews?: number;
  contribution?: number;
  currency?: string;
}

export function computeTikTokCreativeCommerceMetrics(
  observation: TikTokCreativeCommerceObservation,
): TikTokCreativeCommerceMetrics {
  assertTikTokCreativeCommerceObservation(observation);

  const productClickRate =
    observation.productClicks !== undefined && observation.views > 0
      ? observation.productClicks / observation.views
      : undefined;
  const orderConversionRate =
    observation.orders !== undefined &&
    observation.productClicks !== undefined &&
    observation.productClicks > 0
      ? observation.orders / observation.productClicks
      : undefined;
  const ordersPerThousandViews =
    observation.orders !== undefined && observation.views > 0
      ? (observation.orders / observation.views) * 1000
      : undefined;

  let commissionPerThousandViews: number | undefined;
  let contribution: number | undefined;
  let currency: string | undefined;

  if (observation.commissionEarned) {
    currency = observation.commissionEarned.currency;
    commissionPerThousandViews =
      observation.views > 0
        ? (observation.commissionEarned.value / observation.views) * 1000
        : undefined;
  }
  if (observation.commissionEarned && observation.contentCost) {
    if (observation.commissionEarned.currency !== observation.contentCost.currency) {
      throw new Error("TIKTOK_CREATIVE_CURRENCY_MISMATCH");
    }
    contribution =
      observation.commissionEarned.value - observation.contentCost.value;
  }

  return Object.freeze({
    productClickRate,
    orderConversionRate,
    ordersPerThousandViews,
    commissionPerThousandViews,
    contribution,
    currency,
  });
}

export function assertTikTokShopProductObservation(
  observation: TikTokShopProductObservation,
): void {
  for (const [field, value] of [
    ["observationId", observation.observationId],
    ["provider", observation.provider],
    ["productRef", observation.productRef],
    ["productName", observation.productName],
  ] as const) {
    if (!value.trim()) throw new Error(`TIKTOK_PRODUCT_${field.toUpperCase()}_REQUIRED`);
  }

  assertTimestamp(observation.observedAt, "TIKTOK_PRODUCT_OBSERVED_AT_INVALID");
  if (observation.listedAt) {
    assertTimestamp(observation.listedAt, "TIKTOK_PRODUCT_LISTED_AT_INVALID");
  }
  if (!observation.evidenceRefs.length) {
    throw new Error("TIKTOK_PRODUCT_EVIDENCE_REQUIRED");
  }
  if (observation.listingUrl && !isHttpUrl(observation.listingUrl)) {
    throw new Error("TIKTOK_PRODUCT_LISTING_URL_INVALID");
  }

  assertMoneyMetric(observation.price, "PRICE");
  assertOptionalMetric(observation.unitsSold, "UNITS_SOLD");
  assertOptionalMoneyMetric(observation.gmv, "GMV");
  if (observation.weeklyGmvGrowthRate) {
    assertMetric(observation.weeklyGmvGrowthRate, "WEEKLY_GMV_GROWTH_RATE", {
      allowNegative: true,
    });
  }
  assertOptionalMetric(observation.reviewCount, "REVIEW_COUNT");
  assertOptionalMetric(observation.creatorCount, "CREATOR_COUNT");
  assertOptionalMetric(observation.shoppableContentCount, "SHOPPABLE_CONTENT_COUNT");
  assertOptionalMetric(observation.sellerCount, "SELLER_COUNT");
  if (observation.commissionRate) {
    assertMetric(observation.commissionRate, "COMMISSION_RATE");
    assertRate(
      observation.commissionRate.value,
      "TIKTOK_PRODUCT_COMMISSION_RATE_INVALID",
    );
  }
  assertOptionalMoneyMetric(
    observation.commissionValuePerOrder,
    "COMMISSION_VALUE_PER_ORDER",
  );
  assertOptionalMetric(
    observation.adSupportedCreativeCount,
    "AD_SUPPORTED_CREATIVE_COUNT",
  );
  assertOptionalMetric(
    observation.liveSalesEventCount,
    "LIVE_SALES_EVENT_COUNT",
  );

  for (const contribution of observation.creatorContributions) {
    if (!contribution.creatorRef.trim()) {
      throw new Error("TIKTOK_PRODUCT_CREATOR_REF_REQUIRED");
    }
    if (!contribution.evidenceRefs.length) {
      throw new Error("TIKTOK_PRODUCT_CREATOR_EVIDENCE_REQUIRED");
    }
    assertOptionalMoneyMetric(
      contribution.attributedGmv,
      "CREATOR_ATTRIBUTED_GMV",
    );
    assertOptionalMetric(
      contribution.attributedUnits,
      "CREATOR_ATTRIBUTED_UNITS",
    );
  }
}

export function assertTikTokCreativeCommerceObservation(
  observation: TikTokCreativeCommerceObservation,
): void {
  if (!observation.observationId.trim()) {
    throw new Error("TIKTOK_CREATIVE_OBSERVATION_ID_REQUIRED");
  }
  if (!observation.productRef.trim() || !observation.contentRef.trim()) {
    throw new Error("TIKTOK_CREATIVE_REFERENCE_REQUIRED");
  }
  if (!Number.isFinite(observation.views) || observation.views < 0) {
    throw new Error("TIKTOK_CREATIVE_VIEWS_INVALID");
  }
  for (const [field, value] of [
    ["PRODUCT_CLICKS", observation.productClicks],
    ["ORDERS", observation.orders],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < 0)
    ) {
      throw new Error(`TIKTOK_CREATIVE_${field}_INVALID`);
    }
  }
  if (!observation.evidenceRefs.length) {
    throw new Error("TIKTOK_CREATIVE_EVIDENCE_REQUIRED");
  }
  assertTimestamp(observation.observedAt, "TIKTOK_CREATIVE_OBSERVED_AT_INVALID");
  assertOptionalMoneyMetric(observation.attributedRevenue, "ATTRIBUTED_REVENUE");
  assertOptionalMoneyMetric(observation.commissionEarned, "COMMISSION_EARNED");
  assertOptionalMoneyMetric(observation.contentCost, "CONTENT_COST");
}

function assertCreatorConcentrationThresholds(
  thresholds: TikTokCreatorConcentrationThresholds,
): void {
  if (
    !Number.isInteger(thresholds.diversifiedMinimumCreators) ||
    thresholds.diversifiedMinimumCreators < 2
  ) {
    throw new Error("TIKTOK_CREATOR_CONCENTRATION_THRESHOLDS_INVALID");
  }
  for (const value of [
    thresholds.diversifiedMaximumTopShare,
    thresholds.diversifiedMaximumHhi,
    thresholds.concentratedMinimumTopShare,
    thresholds.concentratedMinimumHhi,
  ]) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error("TIKTOK_CREATOR_CONCENTRATION_THRESHOLDS_INVALID");
    }
  }
}

function assertOptionalMetric(
  metric: TikTokNumericMetric | undefined,
  field: string,
): void {
  if (metric) assertMetric(metric, field);
}

function assertOptionalMoneyMetric(
  metric: TikTokMoneyMetric | undefined,
  field: string,
): void {
  if (metric) assertMoneyMetric(metric, field);
}

function assertMetric(
  metric: TikTokNumericMetric,
  field: string,
  options: { allowNegative?: boolean } = {},
): void {
  if (
    !Number.isFinite(metric.value) ||
    (!options.allowNegative && metric.value < 0)
  ) {
    throw new Error(`TIKTOK_PRODUCT_${field}_INVALID`);
  }
  if (metric.sourceRef !== undefined && !metric.sourceRef.trim()) {
    throw new Error(`TIKTOK_PRODUCT_${field}_SOURCE_REF_INVALID`);
  }
}

function assertMoneyMetric(metric: TikTokMoneyMetric, field: string): void {
  assertMetric(metric, field);
  if (!metric.currency.trim()) {
    throw new Error(`TIKTOK_PRODUCT_${field}_CURRENCY_REQUIRED`);
  }
}

function assertRate(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(code);
}

function assertTimestamp(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
