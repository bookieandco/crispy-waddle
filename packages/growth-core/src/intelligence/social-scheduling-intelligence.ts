import type { GrowthId, ISODateTime } from "../domain/types.js";
import type { NicheAlgorithmProfile, PortfolioSocialPlatform } from "./social-portfolio-autopilot.js";

export interface SocialScheduleCandidateSlot {
  id: GrowthId;
  platform: PortfolioSocialPlatform;
  scheduledAt: ISODateTime;
  audienceLocalWindow: string;
  contentFormat: string;
  creativeMechanic: string;
  capacityRef: string;
  evidenceRefs: readonly string[];
}

export interface RankedSocialScheduleSlot extends SocialScheduleCandidateSlot {
  score: number;
  reasons: readonly string[];
}

export interface SocialScheduleRecommendation {
  profileId: GrowthId;
  nicheKey: string;
  platform: PortfolioSocialPlatform;
  rankedSlots: readonly RankedSocialScheduleSlot[];
  evidenceRefs: readonly string[];
  policy: Readonly<{
    learnedFromObservedNichePerformance: true;
    universalBestTimeAssumptionAllowed: false;
    rankingDoesNotGuaranteeDistribution: true;
    staleAlgorithmEvidenceMustNotDriveSchedule: true;
  }>;
  authority: "SCHEDULE_RECOMMENDATION_ONLY";
}

export function rankNicheSocialSchedule(input: {
  profile: NicheAlgorithmProfile;
  slots: readonly SocialScheduleCandidateSlot[];
  asOf?: ISODateTime;
  maxProfileAgeDays?: number;
}): SocialScheduleRecommendation {
  if (!input.slots.length) {
    throw new Error("GROWTH_SOCIAL_SCHEDULE_SLOTS_REQUIRED");
  }
  const asOf = input.asOf ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(asOf))) {
    throw new Error("GROWTH_SOCIAL_SCHEDULE_AS_OF_INVALID");
  }
  const maxProfileAgeDays = input.maxProfileAgeDays ?? 45;
  if (!Number.isFinite(maxProfileAgeDays) || maxProfileAgeDays <= 0) {
    throw new Error("GROWTH_SOCIAL_SCHEDULE_MAX_AGE_INVALID");
  }
  if (
    Date.parse(asOf) - Date.parse(input.profile.observedThrough)
    > maxProfileAgeDays * 86_400_000
  ) {
    throw new Error("GROWTH_SOCIAL_SCHEDULE_PROFILE_STALE");
  }

  const strongestWindowScore = Math.max(
    1,
    ...input.profile.strongestTimeWindows.map((row) => Math.max(0, row.score)),
  );
  const windowByName = new Map(
    input.profile.strongestTimeWindows.map((row) => [
      row.timeWindow,
      Math.max(0, row.score) / strongestWindowScore,
    ]),
  );
  const mechanicRank = new Map(
    input.profile.strongestMechanics.map((row, index) => [
      row.mechanic,
      Math.max(0.2, 1 - index * 0.18),
    ]),
  );
  const formatRank = new Map(
    input.profile.strongestFormats.map((row, index) => [
      row.format,
      Math.max(0.2, 1 - index * 0.18),
    ]),
  );

  const businessSignal =
    input.profile.baselines.conversionRate > 0
    || input.profile.baselines.contributionMarginPerThousandImpressions > 0
      ? 1
      : 0.35;

  const rankedSlots = input.slots.map((slot) => {
    if (slot.platform !== input.profile.platform) {
      throw new Error("GROWTH_SOCIAL_SCHEDULE_PLATFORM_MISMATCH");
    }
    if (!Number.isFinite(Date.parse(slot.scheduledAt))) {
      throw new Error("GROWTH_SOCIAL_SCHEDULE_TIME_INVALID");
    }
    if (Date.parse(slot.scheduledAt) <= Date.parse(asOf)) {
      throw new Error("GROWTH_SOCIAL_SCHEDULE_SLOT_NOT_FUTURE");
    }
    for (const value of [
      slot.id,
      slot.audienceLocalWindow,
      slot.contentFormat,
      slot.creativeMechanic,
      slot.capacityRef,
    ]) {
      if (!String(value).trim()) {
        throw new Error("GROWTH_SOCIAL_SCHEDULE_SLOT_FIELD_REQUIRED");
      }
    }
    if (!slot.evidenceRefs.length) {
      throw new Error("GROWTH_SOCIAL_SCHEDULE_SLOT_EVIDENCE_REQUIRED");
    }

    const windowFit = windowByName.get(slot.audienceLocalWindow) ?? 0.15;
    const mechanicFit = mechanicRank.get(slot.creativeMechanic) ?? 0.25;
    const formatFit = formatRank.get(slot.contentFormat) ?? 0.25;
    const score = round(100 * (
      windowFit * 0.45
      + mechanicFit * 0.25
      + formatFit * 0.15
      + businessSignal * 0.15
    ));

    return Object.freeze({
      ...slot,
      evidenceRefs: Object.freeze([...slot.evidenceRefs]),
      score,
      reasons: Object.freeze([
        `timeWindowFit=${round(windowFit * 100)}`,
        `mechanicFit=${round(mechanicFit * 100)}`,
        `formatFit=${round(formatFit * 100)}`,
        `businessSignal=${round(businessSignal * 100)}`,
      ]),
    });
  }).sort((a, b) =>
    b.score - a.score
    || Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)
    || a.id.localeCompare(b.id),
  );

  return Object.freeze({
    profileId: input.profile.id,
    nicheKey: input.profile.nicheKey,
    platform: input.profile.platform,
    rankedSlots: Object.freeze(rankedSlots),
    evidenceRefs: Object.freeze(unique([
      ...input.profile.evidenceRefs,
      ...rankedSlots.flatMap((slot) => slot.evidenceRefs),
    ])),
    policy: Object.freeze({
      learnedFromObservedNichePerformance: true as const,
      universalBestTimeAssumptionAllowed: false as const,
      rankingDoesNotGuaranteeDistribution: true as const,
      staleAlgorithmEvidenceMustNotDriveSchedule: true as const,
    }),
    authority: "SCHEDULE_RECOMMENDATION_ONLY" as const,
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
