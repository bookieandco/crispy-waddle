import type { GrowthId, ISODateTime } from "../domain/types.js";

export type CreatorPlatform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "facebook"
  | "x"
  | "linkedin"
  | "email"
  | (string & {});

export type CreatorEligibility =
  | "eligible"
  | "ineligible"
  | "suppressed"
  | "unknown";

export interface CreatorEvidence {
  creatorRef: GrowthId;
  platform: CreatorPlatform;
  sourceRef: string;
  observedAt: ISODateTime;
  evidenceRefs: readonly string[];
  nicheTags: readonly string[];
  audienceSignals: readonly string[];
  productAffinitySignals: readonly string[];
  followerCount?: number;
  averageViews?: number;
  engagementRate?: number;
  priorCollaborationRefs?: readonly string[];
}

export interface CreatorFitAssessment {
  assessmentId: GrowthId;
  creatorRef: GrowthId;
  campaignId: GrowthId;
  suitability:
    | "supported"
    | "partially_supported"
    | "unsupported"
    | "unknown";
  commercialFit?: number;
  finding: string;
  evidenceRefs: readonly string[];
  observedAt: ISODateTime;
}

export type OutreachStopState =
  | "active"
  | "declined"
  | "stop_contact"
  | "suppressed"
  | "completed"
  | "archived";

export interface OutreachPlan {
  planId: GrowthId;
  campaignId: GrowthId;
  creatorRef: GrowthId;
  brandId: GrowthId;
  channel: CreatorPlatform;
  offerRef: string;
  brandVoiceProfileRef: string;
  channelVoiceProfileRef: string;
  messageDraftRefs: readonly string[];
  eligibility: CreatorEligibility;
  eligibilityEvidenceRefs: readonly string[];
  maxTouches: number;
  stopState: OutreachStopState;
  createdAt: ISODateTime;
  expiresAt: ISODateTime;
}

export interface OutreachTouchDraft {
  touchId: GrowthId;
  planId: GrowthId;
  ordinal: number;
  message: string;
  valueAdd: string;
  status: "draft";
}

export interface OutreachTouchProposal {
  touchId: GrowthId;
  planId: GrowthId;
  creatorRef: GrowthId;
  channel: CreatorPlatform;
  ordinal: number;
  exactMessageFingerprint: string;
  dueAt: ISODateTime;
  eligibilityEvidenceRefs: readonly string[];
  offerRef: string;
  brandVoiceProfileRef: string;
  channelVoiceProfileRef: string;
}

/**
 * Outreach planning is reversible. Sending is not.
 *
 * This helper prepares only the single currently-due touch for a later
 * governed Social/Action Core approval flow. Future touches remain drafts.
 */
export function prepareOutreachTouchProposal(input: {
  plan: OutreachPlan;
  draft: OutreachTouchDraft;
  dueAt: ISODateTime;
}): OutreachTouchProposal {
  assertOutreachPlan(input.plan);
  assertOutreachTouchDraft(input.draft);

  if (input.draft.planId !== input.plan.planId) {
    throw new Error("OUTREACH_TOUCH_PLAN_MISMATCH");
  }
  if (input.plan.stopState !== "active") {
    throw new Error("OUTREACH_PLAN_STOPPED");
  }
  if (input.plan.eligibility !== "eligible") {
    throw new Error("OUTREACH_ELIGIBILITY_REQUIRED");
  }
  if (input.draft.ordinal > input.plan.maxTouches) {
    throw new Error("OUTREACH_TOUCH_LIMIT_EXCEEDED");
  }
  assertTimestamp(input.dueAt, "OUTREACH_DUE_AT_INVALID");
  if (input.dueAt > input.plan.expiresAt) {
    throw new Error("OUTREACH_TOUCH_AFTER_PLAN_EXPIRY");
  }

  return Object.freeze({
    touchId: input.draft.touchId,
    planId: input.plan.planId,
    creatorRef: input.plan.creatorRef,
    channel: input.plan.channel,
    ordinal: input.draft.ordinal,
    exactMessageFingerprint: fingerprintOutreachMessage({
      planId: input.plan.planId,
      creatorRef: input.plan.creatorRef,
      channel: input.plan.channel,
      ordinal: input.draft.ordinal,
      message: input.draft.message,
      offerRef: input.plan.offerRef,
      brandVoiceProfileRef: input.plan.brandVoiceProfileRef,
      channelVoiceProfileRef: input.plan.channelVoiceProfileRef,
    }),
    dueAt: new Date(input.dueAt).toISOString(),
    eligibilityEvidenceRefs: Object.freeze([...input.plan.eligibilityEvidenceRefs]),
    offerRef: input.plan.offerRef,
    brandVoiceProfileRef: input.plan.brandVoiceProfileRef,
    channelVoiceProfileRef: input.plan.channelVoiceProfileRef,
  });
}

export function fingerprintOutreachMessage(input: {
  planId: GrowthId;
  creatorRef: GrowthId;
  channel: CreatorPlatform;
  ordinal: number;
  message: string;
  offerRef: string;
  brandVoiceProfileRef: string;
  channelVoiceProfileRef: string;
}): string {
  const message = input.message.trim();
  if (!message) throw new Error("OUTREACH_MESSAGE_REQUIRED");
  return JSON.stringify({
    v: 1,
    planId: input.planId,
    creatorRef: input.creatorRef,
    channel: input.channel,
    ordinal: input.ordinal,
    message,
    offerRef: input.offerRef,
    brandVoiceProfileRef: input.brandVoiceProfileRef,
    channelVoiceProfileRef: input.channelVoiceProfileRef,
  });
}

export function assertCreatorEvidence(evidence: CreatorEvidence): void {
  if (!evidence.creatorRef.trim()) throw new Error("CREATOR_REF_REQUIRED");
  if (!evidence.sourceRef.trim()) throw new Error("CREATOR_SOURCE_REF_REQUIRED");
  if (!evidence.evidenceRefs.length) throw new Error("CREATOR_EVIDENCE_REQUIRED");
  assertTimestamp(evidence.observedAt, "CREATOR_OBSERVED_AT_INVALID");
  for (const value of [evidence.followerCount, evidence.averageViews]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error("CREATOR_METRIC_INVALID");
    }
  }
  if (
    evidence.engagementRate !== undefined &&
    (!Number.isFinite(evidence.engagementRate) ||
      evidence.engagementRate < 0 ||
      evidence.engagementRate > 1)
  ) {
    throw new Error("CREATOR_ENGAGEMENT_RATE_INVALID");
  }
}

export function assertOutreachPlan(plan: OutreachPlan): void {
  if (!plan.planId.trim()) throw new Error("OUTREACH_PLAN_ID_REQUIRED");
  if (!plan.creatorRef.trim()) throw new Error("OUTREACH_CREATOR_REF_REQUIRED");
  if (!plan.campaignId.trim()) throw new Error("OUTREACH_CAMPAIGN_ID_REQUIRED");
  if (!plan.offerRef.trim()) throw new Error("OUTREACH_OFFER_REF_REQUIRED");
  if (!plan.brandVoiceProfileRef.trim() || !plan.channelVoiceProfileRef.trim()) {
    throw new Error("OUTREACH_VOICE_PROFILE_REQUIRED");
  }
  if (!plan.eligibilityEvidenceRefs.length) {
    throw new Error("OUTREACH_ELIGIBILITY_EVIDENCE_REQUIRED");
  }
  if (!Number.isInteger(plan.maxTouches) || plan.maxTouches < 1 || plan.maxTouches > 5) {
    throw new Error("OUTREACH_MAX_TOUCHES_INVALID");
  }
  assertTimestamp(plan.createdAt, "OUTREACH_CREATED_AT_INVALID");
  assertTimestamp(plan.expiresAt, "OUTREACH_EXPIRES_AT_INVALID");
  if (plan.expiresAt <= plan.createdAt) throw new Error("OUTREACH_PLAN_EXPIRY_INVALID");
}

export function assertOutreachTouchDraft(draft: OutreachTouchDraft): void {
  if (!draft.touchId.trim()) throw new Error("OUTREACH_TOUCH_ID_REQUIRED");
  if (!draft.planId.trim()) throw new Error("OUTREACH_TOUCH_PLAN_ID_REQUIRED");
  if (!Number.isInteger(draft.ordinal) || draft.ordinal < 1) {
    throw new Error("OUTREACH_TOUCH_ORDINAL_INVALID");
  }
  if (!draft.message.trim()) throw new Error("OUTREACH_MESSAGE_REQUIRED");
  if (!draft.valueAdd.trim()) throw new Error("OUTREACH_VALUE_ADD_REQUIRED");
}

function assertTimestamp(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}
