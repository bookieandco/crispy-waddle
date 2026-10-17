import type { GrowthId } from "../domain/types.js";
import type { PortfolioSocialPlatform } from "./social-portfolio-autopilot.js";
import type { PaidAccelerationReadiness } from "./social-paid-acceleration-readiness.js";

export type AudienceLanguageSignalKind =
  | "pain"
  | "desire"
  | "objection"
  | "question";

export interface AudienceLanguageSignal {
  id: GrowthId;
  kind: AudienceLanguageSignalKind;
  text: string;
  source:
    | "customer_interview"
    | "first_party_support"
    | "review"
    | "public_comment"
    | "public_forum"
    | "search_query"
    | "other";
  evidenceRefs: readonly string[];
}

export interface AudienceLanguageMap {
  brandId: GrowthId;
  signals: readonly AudienceLanguageSignal[];
  pains: readonly string[];
  desires: readonly string[];
  objections: readonly string[];
  questions: readonly string[];
  evidenceRefs: readonly string[];
  policy: Readonly<{
    useObservedAudienceLanguage: true;
    inventedPainPointsAllowed: false;
    sensitiveTraitInferenceAllowed: false;
  }>;
  authority: "AUDIENCE_LANGUAGE_RESEARCH_ONLY";
}

export interface AcquisitionPlatformCandidate {
  platform: PortfolioSocialPlatform | "email" | "web" | "search";
  audienceFit: number;
  operatorFit: number;
  discoveryLongevity: number;
  nativeFormatFit: number;
  commercialEvidence: number;
  evidenceRefs: readonly string[];
}

export interface PrimaryAcquisitionPlatformPlan {
  primaryPlatform: AcquisitionPlatformCandidate["platform"];
  score: number;
  reasons: readonly string[];
  repurposeSurfaces: readonly AcquisitionPlatformCandidate["platform"][];
  evidenceRefs: readonly string[];
  policy: Readonly<{
    onePrimaryAcquisitionSurfaceAtATime: true;
    secondarySurfacesAreRepurposeDestinations: true;
    blindCrossPostingAllowed: false;
    platformChoiceMustBeRelearnedFromOutcomes: true;
  }>;
  authority: "PLATFORM_STRATEGY_ONLY";
}

export type OrganicContentRole = "brand" | "conversion";

export interface OrganicDemandContentBrief {
  id: GrowthId;
  role: OrganicContentRole;
  topic: string;
  hook: string;
  audienceSignalRefs: readonly GrowthId[];
  ctaKind: "engage" | "learn_more" | "lead_capture" | "offer";
  destinationRef: string;
  sourceAssetRef?: string;
  faceless?: boolean;
  visualIdentityRef?: string;
  evidenceRefs: readonly string[];
}

export interface OwnedAudienceCapturePlan {
  destinationRef: string;
  leadMagnetRef: string;
  consentCaptureRef: string;
  nurtureSequenceRef: string;
  nurtureTouchCount: number;
  evidenceRefs: readonly string[];
  policy: Readonly<{
    explicitConsentRequired: true;
    purchasedOrScrapedListsAllowed: false;
    unsubscribeMustBeHonored: true;
    socialFollowersAreNotOwnedAudience: true;
  }>;
  authority: "OWNED_AUDIENCE_PLAN_ONLY";
}

export interface OrganicDemandSystemPlan {
  brandId: GrowthId;
  audience: AudienceLanguageMap;
  platform: PrimaryAcquisitionPlatformPlan;
  content: readonly OrganicDemandContentBrief[];
  ownedCapture: OwnedAudienceCapturePlan;
  paidReadiness?: PaidAccelerationReadiness;
  peso: Readonly<{
    paid: "hold" | "bounded_test" | "accelerate";
    earned: "cultivate";
    shared: "active";
    owned: "priority";
  }>;
  evidenceRefs: readonly string[];
  policy: Readonly<{
    contentBeforePaid: true;
    brandAndConversionContentBothRequired: true;
    everyContentItemNeedsAJobAndDestination: true;
    batchAndSchedulePreferred: true;
    nativeAdaptationRequiredWhenRepurposed: true;
    ownedAudienceCompoundsBeyondPlatformAlgorithms: true;
    facelessIdentityMustRemainRecognizable: true;
  }>;
  authority: "ORGANIC_DEMAND_STRATEGY_ONLY";
}

export function buildAudienceLanguageMap(input: {
  brandId: GrowthId;
  signals: readonly AudienceLanguageSignal[];
}): AudienceLanguageMap {
  requireText(input.brandId, "brandId");
  if (!input.signals.length) {
    throw new Error("GROWTH_AUDIENCE_LANGUAGE_SIGNAL_REQUIRED");
  }

  const seen = new Set<string>();
  const validated = input.signals.map((signal) => {
    requireText(signal.id, "signal.id");
    requireText(signal.text, "signal.text");
    if (!signal.evidenceRefs.length) {
      throw new Error("GROWTH_AUDIENCE_LANGUAGE_EVIDENCE_REQUIRED");
    }
    if (seen.has(signal.id)) {
      throw new Error("GROWTH_AUDIENCE_LANGUAGE_SIGNAL_DUPLICATE");
    }
    seen.add(signal.id);
    return Object.freeze({
      ...signal,
      text: clean(signal.text),
      evidenceRefs: Object.freeze(unique(signal.evidenceRefs)),
    });
  });

  const byKind = (kind: AudienceLanguageSignalKind) =>
    Object.freeze(
      validated
        .filter((signal) => signal.kind === kind)
        .map((signal) => signal.text),
    );

  return Object.freeze({
    brandId: input.brandId,
    signals: Object.freeze(validated),
    pains: byKind("pain"),
    desires: byKind("desire"),
    objections: byKind("objection"),
    questions: byKind("question"),
    evidenceRefs: Object.freeze(
      unique(validated.flatMap((signal) => signal.evidenceRefs)),
    ),
    policy: Object.freeze({
      useObservedAudienceLanguage: true as const,
      inventedPainPointsAllowed: false as const,
      sensitiveTraitInferenceAllowed: false as const,
    }),
    authority: "AUDIENCE_LANGUAGE_RESEARCH_ONLY" as const,
  });
}

export function selectPrimaryAcquisitionPlatform(input: {
  candidates: readonly AcquisitionPlatformCandidate[];
  maxRepurposeSurfaces?: number;
}): PrimaryAcquisitionPlatformPlan {
  if (!input.candidates.length) {
    throw new Error("GROWTH_PRIMARY_PLATFORM_CANDIDATE_REQUIRED");
  }
  const maxRepurposeSurfaces = input.maxRepurposeSurfaces ?? 3;
  if (
    !Number.isInteger(maxRepurposeSurfaces)
    || maxRepurposeSurfaces < 0
    || maxRepurposeSurfaces > 10
  ) {
    throw new Error("GROWTH_PRIMARY_PLATFORM_REPURPOSE_LIMIT_INVALID");
  }

  const ranked = input.candidates.map((candidate) => {
    for (const [name, value] of Object.entries({
      audienceFit: candidate.audienceFit,
      operatorFit: candidate.operatorFit,
      discoveryLongevity: candidate.discoveryLongevity,
      nativeFormatFit: candidate.nativeFormatFit,
      commercialEvidence: candidate.commercialEvidence,
    })) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error("GROWTH_PRIMARY_PLATFORM_SCORE_INVALID:" + name);
      }
    }
    if (!candidate.evidenceRefs.length) {
      throw new Error("GROWTH_PRIMARY_PLATFORM_EVIDENCE_REQUIRED");
    }
    const score = round(100 * (
      candidate.audienceFit * 0.35
      + candidate.operatorFit * 0.20
      + candidate.discoveryLongevity * 0.15
      + candidate.nativeFormatFit * 0.15
      + candidate.commercialEvidence * 0.15
    ));
    return { candidate, score };
  }).sort((a, b) =>
    b.score - a.score
    || String(a.candidate.platform).localeCompare(String(b.candidate.platform)),
  );

  const primary = ranked[0]!;
  const repurposeSurfaces = ranked
    .slice(1, 1 + maxRepurposeSurfaces)
    .map((row) => row.candidate.platform);

  return Object.freeze({
    primaryPlatform: primary.candidate.platform,
    score: primary.score,
    reasons: Object.freeze([
      "audienceFit=" + round(primary.candidate.audienceFit * 100),
      "operatorFit=" + round(primary.candidate.operatorFit * 100),
      "discoveryLongevity=" + round(
        primary.candidate.discoveryLongevity * 100,
      ),
      "nativeFormatFit=" + round(
        primary.candidate.nativeFormatFit * 100,
      ),
      "commercialEvidence=" + round(
        primary.candidate.commercialEvidence * 100,
      ),
    ]),
    repurposeSurfaces: Object.freeze(repurposeSurfaces),
    evidenceRefs: Object.freeze(unique(
      ranked.flatMap((row) => row.candidate.evidenceRefs),
    )),
    policy: Object.freeze({
      onePrimaryAcquisitionSurfaceAtATime: true as const,
      secondarySurfacesAreRepurposeDestinations: true as const,
      blindCrossPostingAllowed: false as const,
      platformChoiceMustBeRelearnedFromOutcomes: true as const,
    }),
    authority: "PLATFORM_STRATEGY_ONLY" as const,
  });
}

export function buildOwnedAudienceCapturePlan(input: {
  destinationRef: string;
  leadMagnetRef: string;
  consentCaptureRef: string;
  nurtureSequenceRef: string;
  nurtureTouchCount?: number;
  evidenceRefs: readonly string[];
}): OwnedAudienceCapturePlan {
  for (const [field, value] of Object.entries({
    destinationRef: input.destinationRef,
    leadMagnetRef: input.leadMagnetRef,
    consentCaptureRef: input.consentCaptureRef,
    nurtureSequenceRef: input.nurtureSequenceRef,
  })) {
    requireText(value, field);
  }
  if (!input.evidenceRefs.length) {
    throw new Error("GROWTH_OWNED_CAPTURE_EVIDENCE_REQUIRED");
  }
  const nurtureTouchCount = input.nurtureTouchCount ?? 5;
  if (
    !Number.isInteger(nurtureTouchCount)
    || nurtureTouchCount < 1
    || nurtureTouchCount > 30
  ) {
    throw new Error("GROWTH_OWNED_CAPTURE_NURTURE_COUNT_INVALID");
  }

  return Object.freeze({
    destinationRef: input.destinationRef,
    leadMagnetRef: input.leadMagnetRef,
    consentCaptureRef: input.consentCaptureRef,
    nurtureSequenceRef: input.nurtureSequenceRef,
    nurtureTouchCount,
    evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
    policy: Object.freeze({
      explicitConsentRequired: true as const,
      purchasedOrScrapedListsAllowed: false as const,
      unsubscribeMustBeHonored: true as const,
      socialFollowersAreNotOwnedAudience: true as const,
    }),
    authority: "OWNED_AUDIENCE_PLAN_ONLY" as const,
  });
}

export function compileOrganicDemandSystem(input: {
  brandId: GrowthId;
  audience: AudienceLanguageMap;
  platform: PrimaryAcquisitionPlatformPlan;
  content: readonly OrganicDemandContentBrief[];
  ownedCapture: OwnedAudienceCapturePlan;
  paidReadiness?: PaidAccelerationReadiness;
  evidenceRefs: readonly string[];
}): OrganicDemandSystemPlan {
  requireText(input.brandId, "brandId");
  if (input.audience.brandId !== input.brandId) {
    throw new Error("GROWTH_ORGANIC_DEMAND_AUDIENCE_BRAND_MISMATCH");
  }
  if (!input.content.length) {
    throw new Error("GROWTH_ORGANIC_DEMAND_CONTENT_REQUIRED");
  }
  if (!input.evidenceRefs.length) {
    throw new Error("GROWTH_ORGANIC_DEMAND_EVIDENCE_REQUIRED");
  }
  if (
    input.paidReadiness
    && input.paidReadiness.brandId !== input.brandId
  ) {
    throw new Error("GROWTH_ORGANIC_DEMAND_PAID_BRAND_MISMATCH");
  }

  const signalIds = new Set(input.audience.signals.map((signal) => signal.id));
  const briefs = input.content.map((brief) => {
    requireText(brief.id, "content.id");
    requireText(brief.topic, "content.topic");
    requireText(brief.hook, "content.hook");
    requireText(brief.destinationRef, "content.destinationRef");
    if (!brief.audienceSignalRefs.length) {
      throw new Error("GROWTH_ORGANIC_DEMAND_SIGNAL_REF_REQUIRED");
    }
    if (
      brief.audienceSignalRefs.some((ref) => !signalIds.has(ref))
    ) {
      throw new Error("GROWTH_ORGANIC_DEMAND_SIGNAL_REF_UNKNOWN");
    }
    if (!brief.evidenceRefs.length) {
      throw new Error("GROWTH_ORGANIC_DEMAND_CONTENT_EVIDENCE_REQUIRED");
    }
    if (
      brief.faceless
      && !brief.visualIdentityRef?.trim()
    ) {
      throw new Error("GROWTH_FACELESS_VISUAL_IDENTITY_REQUIRED");
    }
    return Object.freeze({
      ...brief,
      topic: clean(brief.topic),
      hook: clean(brief.hook),
      audienceSignalRefs: Object.freeze([...brief.audienceSignalRefs]),
      evidenceRefs: Object.freeze(unique(brief.evidenceRefs)),
    });
  });

  if (!briefs.some((brief) => brief.role === "brand")) {
    throw new Error("GROWTH_ORGANIC_DEMAND_BRAND_CONTENT_REQUIRED");
  }
  if (!briefs.some((brief) => brief.role === "conversion")) {
    throw new Error("GROWTH_ORGANIC_DEMAND_CONVERSION_CONTENT_REQUIRED");
  }

  const paid = input.paidReadiness?.status === "PAID_ACCELERATION_READY"
    ? "accelerate" as const
    : input.paidReadiness?.status === "BOUNDED_PAID_TEST_READY"
      ? "bounded_test" as const
      : "hold" as const;

  return Object.freeze({
    brandId: input.brandId,
    audience: input.audience,
    platform: input.platform,
    content: Object.freeze(briefs),
    ownedCapture: input.ownedCapture,
    paidReadiness: input.paidReadiness,
    peso: Object.freeze({
      paid,
      earned: "cultivate" as const,
      shared: "active" as const,
      owned: "priority" as const,
    }),
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      ...input.audience.evidenceRefs,
      ...input.platform.evidenceRefs,
      ...input.ownedCapture.evidenceRefs,
      ...briefs.flatMap((brief) => brief.evidenceRefs),
      ...(input.paidReadiness?.evidenceRefs ?? []),
    ])),
    policy: Object.freeze({
      contentBeforePaid: true as const,
      brandAndConversionContentBothRequired: true as const,
      everyContentItemNeedsAJobAndDestination: true as const,
      batchAndSchedulePreferred: true as const,
      nativeAdaptationRequiredWhenRepurposed: true as const,
      ownedAudienceCompoundsBeyondPlatformAlgorithms: true as const,
      facelessIdentityMustRemainRecognizable: true as const,
    }),
    authority: "ORGANIC_DEMAND_STRATEGY_ONLY" as const,
  });
}

function requireText(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error("GROWTH_ORGANIC_DEMAND_FIELD_REQUIRED:" + field);
  }
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
