import type { JhadinaBrand, SocialPlatform } from "./types.js";
import type { SocialCharacterProfile } from "./character-profiles.js";

export interface SocialEngagementOpportunity {
  id: string;
  brand: JhadinaBrand;
  platform: SocialPlatform;
  targetContentRef: string;
  targetCreatorRef?: string;
  topic: string;
  publicContextSummary: string;
  brandFit: number;
  audienceOverlap: number;
  freshness: number;
  humorFit: number;
  commercialRelevance: number;
  evidenceRefs: readonly string[];
  observedAt: string;
}

export interface SocialProfileCommentBrief {
  id: string;
  brand: JhadinaBrand;
  platform: SocialPlatform;
  targetContentRef: string;
  targetCreatorRef?: string;
  characterProfileRef: string;
  voiceProfileRef: string;
  speakerIdentityRef?: string;
  relevanceScore: number;
  objective: "participate_usefully" | "join_relevant_conversation";
  toneTraits: readonly string[];
  prompt: string;
  humorAllowed: boolean;
  promotionalLinkAllowed: false;
  requiresWeeklyApproval: true;
  evidenceRefs: readonly string[];
  policy: Readonly<{
    profileVoiceOnly: true;
    identityImitationAllowed: false;
    massEngagementAllowed: false;
    relevanceRequired: true;
    deceptiveRelationshipClaimAllowed: false;
    unsolicitedDirectMessageAuthority: "NONE";
  }>;
  authority: "COMMENT_DRAFT_BRIEF_ONLY";
}

export function compileProfileCommentBrief(input: {
  id: string;
  profile: SocialCharacterProfile;
  opportunity: SocialEngagementOpportunity;
  minimumRelevanceScore?: number;
}): SocialProfileCommentBrief {
  const minimum = input.minimumRelevanceScore ?? 70;
  if (!input.id.trim()) throw new Error("SOCIAL_COMMENT_BRIEF_ID_REQUIRED");
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100) {
    throw new Error("SOCIAL_COMMENT_RELEVANCE_THRESHOLD_INVALID");
  }
  validateOpportunity(input.opportunity);
  if (input.profile.status !== "active") {
    throw new Error("SOCIAL_COMMENT_PROFILE_NOT_ACTIVE");
  }
  if (input.profile.brand !== input.opportunity.brand) {
    throw new Error("SOCIAL_COMMENT_PROFILE_BRAND_MISMATCH");
  }

  const relevanceScore = round(
    input.opportunity.brandFit * 0.35
    + input.opportunity.audienceOverlap * 0.30
    + input.opportunity.freshness * 0.15
    + input.opportunity.commercialRelevance * 0.20,
  );
  if (relevanceScore < minimum) {
    throw new Error("SOCIAL_COMMENT_RELEVANCE_TOO_LOW");
  }

  const humorAllowed = input.opportunity.humorFit >= 65
    && input.profile.toneTraits.some((trait) =>
      ["playful", "sharp", "irreverent", "funny", "witty"].includes(trait.toLowerCase()),
    );

  const prompt = [
    `Target context: ${input.opportunity.publicContextSummary.trim()}`,
    `Topic: ${input.opportunity.topic.trim()}`,
    `Speak only as ${input.profile.label} using profile ${input.profile.id}.`,
    `Tone traits: ${input.profile.toneTraits.join(", ")}.`,
    `Point of view: ${input.profile.pointOfView}`,
    humorAllowed
      ? "A short relevant joke or playful observation is allowed when it fits naturally."
      : "Prioritize relevance and usefulness over humor.",
    "Do not claim a personal relationship with the creator or audience.",
    "Do not imitate the creator's identity or voice.",
    "Do not insert a promotional link.",
    "The comment should make sense as participation in this exact conversation even if no one clicks the profile.",
  ].join("\n");

  return Object.freeze({
    id: input.id,
    brand: input.opportunity.brand,
    platform: input.opportunity.platform,
    targetContentRef: input.opportunity.targetContentRef,
    targetCreatorRef: input.opportunity.targetCreatorRef,
    characterProfileRef: input.profile.id,
    voiceProfileRef: input.profile.voiceProfileRef,
    speakerIdentityRef: input.profile.speakerIdentityRef,
    relevanceScore,
    objective: "join_relevant_conversation" as const,
    toneTraits: Object.freeze([...input.profile.toneTraits]),
    prompt,
    humorAllowed,
    promotionalLinkAllowed: false as const,
    requiresWeeklyApproval: true as const,
    evidenceRefs: Object.freeze(unique([
      ...input.profile.evidenceRefs,
      ...input.opportunity.evidenceRefs,
    ])),
    policy: Object.freeze({
      profileVoiceOnly: true as const,
      identityImitationAllowed: false as const,
      massEngagementAllowed: false as const,
      relevanceRequired: true as const,
      deceptiveRelationshipClaimAllowed: false as const,
      unsolicitedDirectMessageAuthority: "NONE" as const,
    }),
    authority: "COMMENT_DRAFT_BRIEF_ONLY" as const,
  });
}

function validateOpportunity(opportunity: SocialEngagementOpportunity): void {
  for (const value of [
    opportunity.id,
    opportunity.targetContentRef,
    opportunity.topic,
    opportunity.publicContextSummary,
  ]) {
    if (!value.trim()) throw new Error("SOCIAL_COMMENT_OPPORTUNITY_FIELD_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(opportunity.observedAt))) {
    throw new Error("SOCIAL_COMMENT_OPPORTUNITY_TIME_INVALID");
  }
  if (!opportunity.evidenceRefs.length) {
    throw new Error("SOCIAL_COMMENT_OPPORTUNITY_EVIDENCE_REQUIRED");
  }
  for (const [name, value] of Object.entries({
    brandFit: opportunity.brandFit,
    audienceOverlap: opportunity.audienceOverlap,
    freshness: opportunity.freshness,
    humorFit: opportunity.humorFit,
    commercialRelevance: opportunity.commercialRelevance,
  })) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`SOCIAL_COMMENT_OPPORTUNITY_SCORE_INVALID:${name}`);
    }
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
