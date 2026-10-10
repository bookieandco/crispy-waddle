import type { JhadinaBrand, SocialPlatform } from "./types.js";
import type {
  SocialEngagementOpportunity,
} from "./community-engagement.js";

export type SocialEngagementTargetSource =
  | "owner_curated"
  | "jhadina_discovered";

export type SocialEngagementTargetStatus =
  | "active"
  | "paused"
  | "retired";

export interface SocialEngagementTargetAccount {
  id: string;
  brand: JhadinaBrand;
  platform: SocialPlatform;
  accountRef: string;
  handleOrLabel: string;
  source: SocialEngagementTargetSource;
  status: SocialEngagementTargetStatus;
  priority: number;
  topicTags: readonly string[];
  campaignRefs: readonly string[];
  notes?: string;
  addedAt: string;
  evidenceRefs: readonly string[];
  policy: Readonly<{
    publicContentOnly: true;
    observeWithoutApproval: true;
    publicCommentRequiresWeeklyApproval: true;
    automaticDirectMessagesAllowed: false;
    automaticFollowUnfollowAllowed: false;
    massEngagementAllowed: false;
    ownerCuratedDoesNotBypassRelevance: true;
  }>;
  authority: "ENGAGEMENT_TARGET_REGISTRY_ONLY";
}

export interface SocialEngagementContentObservation {
  id: string;
  targetAccountId: string;
  targetContentRef: string;
  targetCreatorRef?: string;
  topic: string;
  publicContextSummary: string;
  observedAt: string;
  brandFit: number;
  audienceOverlap: number;
  freshness: number;
  humorFit: number;
  commercialRelevance: number;
  evidenceRefs: readonly string[];
}

export interface RankedEngagementTarget {
  target: SocialEngagementTargetAccount;
  score: number;
  reasons: readonly string[];
}

export function createCuratedEngagementTarget(input: {
  id: string;
  brand: JhadinaBrand;
  platform: SocialPlatform;
  accountRef: string;
  handleOrLabel: string;
  priority?: number;
  topicTags?: readonly string[];
  campaignRefs?: readonly string[];
  notes?: string;
  addedAt?: string;
  evidenceRefs: readonly string[];
}): SocialEngagementTargetAccount {
  return buildTarget({
    ...input,
    source: "owner_curated",
    priority: input.priority ?? 100,
  });
}

export function createDiscoveredEngagementTarget(input: {
  id: string;
  brand: JhadinaBrand;
  platform: SocialPlatform;
  accountRef: string;
  handleOrLabel: string;
  priority?: number;
  topicTags?: readonly string[];
  campaignRefs?: readonly string[];
  notes?: string;
  addedAt?: string;
  evidenceRefs: readonly string[];
}): SocialEngagementTargetAccount {
  return buildTarget({
    ...input,
    source: "jhadina_discovered",
    priority: input.priority ?? 60,
  });
}

export function rankEngagementTargets(input: {
  targets: readonly SocialEngagementTargetAccount[];
  brand: JhadinaBrand;
  campaignRef?: string;
  topicTags?: readonly string[];
}): readonly RankedEngagementTarget[] {
  const topicTags = new Set(
    (input.topicTags ?? []).map(normalizeTag).filter(Boolean),
  );

  return Object.freeze(
    input.targets
      .filter((target) =>
        target.status === "active"
        && target.brand === input.brand
        && (
          !input.campaignRef
          || target.campaignRefs.length === 0
          || target.campaignRefs.includes(input.campaignRef)
        ),
      )
      .map((target) => {
        const targetTags = target.topicTags.map(normalizeTag);
        const overlap = topicTags.size === 0
          ? 0
          : targetTags.filter((tag) => topicTags.has(tag)).length;
        const ownerBoost = target.source === "owner_curated" ? 20 : 0;
        const campaignBoost = input.campaignRef
          && target.campaignRefs.includes(input.campaignRef)
          ? 10
          : 0;
        const topicBoost = Math.min(20, overlap * 5);
        const score = Math.min(
          100,
          target.priority * 0.5 + ownerBoost + campaignBoost + topicBoost,
        );
        return Object.freeze({
          target,
          score: round(score),
          reasons: Object.freeze([
            "source=" + target.source,
            "priority=" + target.priority,
            "topicOverlap=" + overlap,
            "campaignMatch=" + String(campaignBoost > 0),
          ]),
        });
      })
      .sort((a, b) =>
        b.score - a.score
        || a.target.handleOrLabel.localeCompare(b.target.handleOrLabel),
      ),
  );
}

export function engagementOpportunityFromTargetObservation(input: {
  target: SocialEngagementTargetAccount;
  observation: SocialEngagementContentObservation;
}): SocialEngagementOpportunity {
  if (input.target.status !== "active") {
    throw new Error("SOCIAL_ENGAGEMENT_TARGET_NOT_ACTIVE");
  }
  if (input.observation.targetAccountId !== input.target.id) {
    throw new Error("SOCIAL_ENGAGEMENT_TARGET_OBSERVATION_MISMATCH");
  }
  validateObservation(input.observation);

  return Object.freeze({
    id: input.observation.id,
    brand: input.target.brand,
    platform: input.target.platform,
    targetContentRef: input.observation.targetContentRef,
    targetCreatorRef:
      input.observation.targetCreatorRef ?? input.target.accountRef,
    topic: input.observation.topic,
    publicContextSummary: input.observation.publicContextSummary,
    brandFit: input.observation.brandFit,
    audienceOverlap: input.observation.audienceOverlap,
    freshness: input.observation.freshness,
    humorFit: input.observation.humorFit,
    commercialRelevance: input.observation.commercialRelevance,
    evidenceRefs: Object.freeze(unique([
      ...input.target.evidenceRefs,
      ...input.observation.evidenceRefs,
      "engagement-target:" + input.target.id,
      "engagement-target-source:" + input.target.source,
    ])),
    observedAt: input.observation.observedAt,
  });
}

function buildTarget(input: {
  id: string;
  brand: JhadinaBrand;
  platform: SocialPlatform;
  accountRef: string;
  handleOrLabel: string;
  source: SocialEngagementTargetSource;
  priority: number;
  topicTags?: readonly string[];
  campaignRefs?: readonly string[];
  notes?: string;
  addedAt?: string;
  evidenceRefs: readonly string[];
}): SocialEngagementTargetAccount {
  for (const [field, value] of [
    ["id", input.id],
    ["accountRef", input.accountRef],
    ["handleOrLabel", input.handleOrLabel],
  ] as const) {
    if (!value.trim()) {
      throw new Error("SOCIAL_ENGAGEMENT_TARGET_FIELD_REQUIRED:" + field);
    }
  }
  if (
    !Number.isFinite(input.priority)
    || input.priority < 0
    || input.priority > 100
  ) {
    throw new Error("SOCIAL_ENGAGEMENT_TARGET_PRIORITY_INVALID");
  }
  if (!input.evidenceRefs.length) {
    throw new Error("SOCIAL_ENGAGEMENT_TARGET_EVIDENCE_REQUIRED");
  }
  const addedAt = input.addedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(addedAt))) {
    throw new Error("SOCIAL_ENGAGEMENT_TARGET_ADDED_AT_INVALID");
  }

  return Object.freeze({
    id: input.id.trim(),
    brand: input.brand,
    platform: input.platform,
    accountRef: input.accountRef.trim(),
    handleOrLabel: input.handleOrLabel.trim(),
    source: input.source,
    status: "active" as const,
    priority: input.priority,
    topicTags: Object.freeze(unique(input.topicTags ?? [])),
    campaignRefs: Object.freeze(unique(input.campaignRefs ?? [])),
    notes: clean(input.notes),
    addedAt,
    evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
    policy: Object.freeze({
      publicContentOnly: true as const,
      observeWithoutApproval: true as const,
      publicCommentRequiresWeeklyApproval: true as const,
      automaticDirectMessagesAllowed: false as const,
      automaticFollowUnfollowAllowed: false as const,
      massEngagementAllowed: false as const,
      ownerCuratedDoesNotBypassRelevance: true as const,
    }),
    authority: "ENGAGEMENT_TARGET_REGISTRY_ONLY" as const,
  });
}

function validateObservation(
  observation: SocialEngagementContentObservation,
): void {
  for (const value of [
    observation.id,
    observation.targetAccountId,
    observation.targetContentRef,
    observation.topic,
    observation.publicContextSummary,
  ]) {
    if (!value.trim()) {
      throw new Error("SOCIAL_ENGAGEMENT_OBSERVATION_FIELD_REQUIRED");
    }
  }
  if (!Number.isFinite(Date.parse(observation.observedAt))) {
    throw new Error("SOCIAL_ENGAGEMENT_OBSERVATION_TIME_INVALID");
  }
  if (!observation.evidenceRefs.length) {
    throw new Error("SOCIAL_ENGAGEMENT_OBSERVATION_EVIDENCE_REQUIRED");
  }
  for (const [name, value] of Object.entries({
    brandFit: observation.brandFit,
    audienceOverlap: observation.audienceOverlap,
    freshness: observation.freshness,
    humorFit: observation.humorFit,
    commercialRelevance: observation.commercialRelevance,
  })) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(
        "SOCIAL_ENGAGEMENT_OBSERVATION_SCORE_INVALID:" + name,
      );
    }
  }
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
