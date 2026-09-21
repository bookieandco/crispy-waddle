import type { GrowthId, ISODateTime } from "../domain/types.js";

export type CompetitorAdSource =
  | "meta_ad_library_ui"
  | "meta_ad_library_api"
  | "tiktok_business"
  | "tiktok_shop"
  | "manual"
  | (string & {});

export type CompetitorAdPlatform =
  | "facebook"
  | "instagram"
  | "messenger"
  | "audience_network"
  | "tiktok"
  | "other";

export interface ObservedRange {
  lowerBound?: number;
  upperBound?: number;
  currency?: string;
}

export interface CompetitorAdCreativeReference {
  kind: "image" | "video" | "carousel" | "copy" | "snapshot" | "other";
  locator: string;
}

export interface CompetitorAdObservation {
  observationId: GrowthId;
  provider: string;
  source: CompetitorAdSource;
  sourceRecordId: string;
  advertiserName: string;
  advertiserId?: string;
  advertiserHandle?: string;
  status?: "active" | "inactive" | "unknown";
  platforms: readonly CompetitorAdPlatform[];
  country?: string;
  startedAt?: ISODateTime;
  endedAt?: ISODateTime;
  body?: string;
  headline?: string;
  description?: string;
  callToAction?: string;
  landingUrl?: string;
  landingDomain?: string;
  creativeRefs: readonly CompetitorAdCreativeReference[];
  adsUsingCreative?: number;
  impressions?: ObservedRange;
  spend?: ObservedRange;
  reach?: ObservedRange;
  observedAt: ISODateTime;
  sourceLocator: string;
  sourceEvidenceRefs: readonly string[];
}

/**
 * Validates source-observed competitor-ad facts.
 *
 * This contract intentionally contains no "winner", ROAS, profitability,
 * spend estimate, or creative-quality judgment. Those are downstream
 * hypotheses/analyses and must preserve this observation as evidence.
 */
export function assertCompetitorAdObservation(
  observation: CompetitorAdObservation,
): void {
  if (!observation.observationId.trim()) throw new Error("COMPETITOR_AD_OBSERVATION_ID_REQUIRED");
  if (!observation.provider.trim()) throw new Error("COMPETITOR_AD_PROVIDER_REQUIRED");
  if (!observation.sourceRecordId.trim()) throw new Error("COMPETITOR_AD_SOURCE_RECORD_ID_REQUIRED");
  if (!observation.advertiserName.trim()) throw new Error("COMPETITOR_AD_ADVERTISER_REQUIRED");
  if (!observation.sourceLocator.trim()) throw new Error("COMPETITOR_AD_SOURCE_LOCATOR_REQUIRED");
  if (!observation.sourceEvidenceRefs.length) throw new Error("COMPETITOR_AD_EVIDENCE_REQUIRED");
  assertTimestamp(observation.observedAt, "observedAt");
  if (observation.startedAt) assertTimestamp(observation.startedAt, "startedAt");
  if (observation.endedAt) assertTimestamp(observation.endedAt, "endedAt");
  if (observation.startedAt && observation.endedAt && observation.endedAt < observation.startedAt) {
    throw new Error("COMPETITOR_AD_TIME_RANGE_INVALID");
  }
  if (observation.country && !/^[A-Za-z]{2}$/.test(observation.country)) {
    throw new Error("COMPETITOR_AD_COUNTRY_INVALID");
  }
  if (observation.adsUsingCreative !== undefined &&
      (!Number.isInteger(observation.adsUsingCreative) || observation.adsUsingCreative < 0)) {
    throw new Error("COMPETITOR_AD_CREATIVE_COUNT_INVALID");
  }
  assertObservedRange(observation.impressions, false, "impressions");
  assertObservedRange(observation.reach, false, "reach");
  assertObservedRange(observation.spend, true, "spend");
}

export function competitorAdObservationKey(input: {
  source: CompetitorAdSource;
  sourceRecordId: string;
  observedAt: ISODateTime;
}): string {
  const sourceRecordId = input.sourceRecordId.trim();
  if (!sourceRecordId) throw new Error("COMPETITOR_AD_SOURCE_RECORD_ID_REQUIRED");
  assertTimestamp(input.observedAt, "observedAt");
  return [
    "competitor-ad",
    input.source,
    sourceRecordId,
    new Date(input.observedAt).toISOString(),
  ].join(":");
}

export interface CompetitorCreativePattern {
  patternId: GrowthId;
  kind:
    | "hook"
    | "offer"
    | "cta"
    | "format"
    | "landing_page"
    | "message"
    | "cadence"
    | "other";
  finding: string;
  observationIds: readonly GrowthId[];
  evidenceRefs: readonly string[];
  confidence: number;
  createdAt: ISODateTime;
}

/**
 * Creates an explicitly inferred pattern from observed ads.
 * The result is never an observed fact and cannot authorize campaign changes.
 */
export function createCompetitorCreativePattern(
  input: CompetitorCreativePattern,
): CompetitorCreativePattern {
  if (!input.patternId.trim()) throw new Error("COMPETITOR_PATTERN_ID_REQUIRED");
  if (!input.finding.trim()) throw new Error("COMPETITOR_PATTERN_FINDING_REQUIRED");
  if (!input.observationIds.length) throw new Error("COMPETITOR_PATTERN_OBSERVATIONS_REQUIRED");
  if (!input.evidenceRefs.length) throw new Error("COMPETITOR_PATTERN_EVIDENCE_REQUIRED");
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error("COMPETITOR_PATTERN_CONFIDENCE_INVALID");
  }
  assertTimestamp(input.createdAt, "createdAt");
  return Object.freeze({
    ...input,
    observationIds: Object.freeze([...input.observationIds]),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
  });
}

function assertObservedRange(
  range: ObservedRange | undefined,
  requireCurrency: boolean,
  field: string,
): void {
  if (!range) return;
  for (const value of [range.lowerBound, range.upperBound]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`COMPETITOR_AD_${field.toUpperCase()}_INVALID`);
    }
  }
  if (
    range.lowerBound !== undefined &&
    range.upperBound !== undefined &&
    range.upperBound < range.lowerBound
  ) {
    throw new Error(`COMPETITOR_AD_${field.toUpperCase()}_RANGE_INVALID`);
  }
  if (requireCurrency && !range.currency?.trim()) {
    throw new Error("COMPETITOR_AD_SPEND_CURRENCY_REQUIRED");
  }
}

function assertTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`COMPETITOR_AD_${field.toUpperCase()}_INVALID`);
  }
}
