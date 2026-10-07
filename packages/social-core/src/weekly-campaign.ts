import type {
  JhadinaBrand,
  SocialPlatform,
  SocialPublishTarget,
} from "./types.js";

export interface SocialProfileIdentityBinding {
  characterProfileRef: string;
  voiceProfileRef: string;
  speakerIdentityRef?: string;
  evidenceRefs: readonly string[];
}

export type WeeklySocialActionKind =
  | "organic_publication"
  | "public_comment"
  | "paid_campaign"
  | "director_production";

interface WeeklySocialActionBase {
  id: string;
  campaignId: string;
  brand: JhadinaBrand;
  kind: WeeklySocialActionKind;
  profile: SocialProfileIdentityBinding;
  scheduledAt: string;
  evidenceRefs: readonly string[];
  commercialLineageRef?: string;
}

export interface WeeklyOrganicPublicationAction extends WeeklySocialActionBase {
  kind: "organic_publication";
  target: SocialPublishTarget;
  contentProjectRef: string;
  contentAssetRef: string;
  text: string;
  mediaRefs: readonly string[];
  destinationRef?: string;
}

export interface WeeklyPublicCommentAction extends WeeklySocialActionBase {
  kind: "public_comment";
  platform: SocialPlatform;
  accountId: string;
  targetContentRef: string;
  targetCreatorRef?: string;
  text: string;
  relevanceScore: number;
  relevanceReason: string;
  promotionLinkRef?: string;
  commercialRelevanceEvidenceRefs: readonly string[];
}

export interface WeeklyPaidCampaignAction extends WeeklySocialActionBase {
  kind: "paid_campaign";
  channel:
    | "meta"
    | "google"
    | "tiktok"
    | "linkedin"
    | "reddit"
    | "microsoft"
    | "pinterest"
    | "snapchat"
    | "amazon"
    | "dv360";
  providerAccountId: string;
  objective: string;
  audienceIds: readonly string[];
  creativeIds: readonly string[];
  landingPageRef?: string;
  currency: string;
  dailyBudgetMinor: number;
  lifetimeBudgetMinor?: number;
  experimentRef?: string;
}

export interface WeeklyDirectorProductionAction extends WeeklySocialActionBase {
  kind: "director_production";
  socialContentProjectRef: string;
  socialAssetRef: string;
  directorProjectRef: string;
  productionBriefRef: string;
  requiredBy: string;
  experimentVariantRef?: string;
}

export type WeeklySocialAction =
  | WeeklyOrganicPublicationAction
  | WeeklyPublicCommentAction
  | WeeklyPaidCampaignAction
  | WeeklyDirectorProductionAction;

export interface WeeklySocialCampaign {
  id: string;
  brand: JhadinaBrand;
  name: string;
  profile: SocialProfileIdentityBinding;
  objective: string;
  hypothesis: string;
  ownerIdeaRefs: readonly string[];
  actionIds: readonly string[];
  evidenceRefs: readonly string[];
}

export interface WeeklySocialReportSection {
  campaignId: string;
  brand: JhadinaBrand;
  plannedActions: number;
  organicPublications: number;
  publicComments: number;
  paidTests: number;
  directorJobs: number;
  plannedPaidBudgetMinor: number;
  currency?: string;
  hypotheses: readonly string[];
  ownerIdeaRefs: readonly string[];
  evidenceRefs: readonly string[];
}

export interface WeeklySocialCampaignPacket {
  id: string;
  weekStartsAt: string;
  weekEndsAt: string;
  createdAt: string;
  campaigns: readonly WeeklySocialCampaign[];
  actions: readonly WeeklySocialAction[];
  report: Readonly<{
    sections: readonly WeeklySocialReportSection[];
    totalActions: number;
    totalOrganicPublications: number;
    totalPublicComments: number;
    totalPaidTests: number;
    totalDirectorJobs: number;
    riskFlags: readonly string[];
    evidenceRefs: readonly string[];
  }>;
  fingerprint: string;
  policy: Readonly<{
    oneWeeklyApprovalMayCoverExactPacket: true;
    automaticExecutionOnlyAfterApproval: true;
    dynamicActionsAfterApprovalAllowed: false;
    postApprovalMutationRequiresReapproval: true;
    commentsMustBeRelevantAndProfileBound: true;
    massUnsolicitedEngagementAllowed: false;
    fakeEngagementAllowed: false;
    sensitiveTargetingAllowed: false;
    paidBudgetIncreaseAfterApprovalAllowed: false;
    directorProductionDoesNotGrantPublishAuthority: true;
    directorDerivedMediaMayMaterializeWithinApprovedBrief: true;
    generatedMediaMustMatchApprovedBriefAndQc: true;
  }>;
  authority: "WEEKLY_CAMPAIGN_PROPOSAL_ONLY";
  externalActionAuthorized: false;
}

export interface ApprovedWeeklySocialCampaignPacket
  extends Omit<WeeklySocialCampaignPacket, "authority" | "externalActionAuthorized"> {
  approvalReceiptId: string;
  approvedFingerprint: string;
  authority: "EXACT_WEEKLY_PACKET_APPROVED";
  externalActionAuthorized: true;
}

export function compileWeeklySocialCampaignPacket(input: {
  id: string;
  weekStartsAt: string;
  weekEndsAt: string;
  createdAt?: string;
  campaigns: readonly WeeklySocialCampaign[];
  actions: readonly WeeklySocialAction[];
  riskFlags?: readonly string[];
  evidenceRefs: readonly string[];
}): WeeklySocialCampaignPacket {
  requireText(input.id, "id");
  requireDate(input.weekStartsAt, "weekStartsAt");
  requireDate(input.weekEndsAt, "weekEndsAt");
  const createdAt = input.createdAt ?? new Date().toISOString();
  requireDate(createdAt, "createdAt");

  const starts = Date.parse(input.weekStartsAt);
  const ends = Date.parse(input.weekEndsAt);
  if (ends <= starts) throw new Error("SOCIAL_WEEKLY_WINDOW_INVALID");
  if (ends - starts > 8 * 86_400_000) {
    throw new Error("SOCIAL_WEEKLY_WINDOW_TOO_LONG");
  }
  if (!input.campaigns.length) {
    throw new Error("SOCIAL_WEEKLY_CAMPAIGN_REQUIRED");
  }
  if (!input.actions.length) {
    throw new Error("SOCIAL_WEEKLY_ACTION_REQUIRED");
  }
  if (!input.evidenceRefs.length) {
    throw new Error("SOCIAL_WEEKLY_EVIDENCE_REQUIRED");
  }

  const campaignById = new Map<string, WeeklySocialCampaign>();
  for (const campaign of input.campaigns) {
    validateCampaign(campaign);
    if (campaignById.has(campaign.id)) {
      throw new Error("SOCIAL_WEEKLY_CAMPAIGN_DUPLICATE");
    }
    campaignById.set(campaign.id, freezeCampaign(campaign));
  }

  const actionIds = new Set<string>();
  const actions = input.actions.map((action) => {
    validateAction(action, starts, ends);
    if (actionIds.has(action.id)) {
      throw new Error("SOCIAL_WEEKLY_ACTION_DUPLICATE");
    }
    actionIds.add(action.id);
    const campaign = campaignById.get(action.campaignId);
    if (!campaign) throw new Error("SOCIAL_WEEKLY_ACTION_CAMPAIGN_UNKNOWN");
    if (campaign.brand !== action.brand) {
      throw new Error("SOCIAL_WEEKLY_ACTION_BRAND_MISMATCH");
    }
    assertSameProfile(campaign.profile, action.profile);
    return freezeAction(action);
  });

  for (const campaign of campaignById.values()) {
    const actual = actions
      .filter((action) => action.campaignId === campaign.id)
      .map((action) => action.id)
      .sort();
    const declared = [...campaign.actionIds].sort();
    if (actual.join("|") !== declared.join("|")) {
      throw new Error("SOCIAL_WEEKLY_CAMPAIGN_ACTION_SET_MISMATCH");
    }
  }

  const sections = [...campaignById.values()].map((campaign) =>
    buildReportSection(campaign, actions),
  );
  const currencies = unique(
    actions
      .filter((action): action is WeeklyPaidCampaignAction =>
        action.kind === "paid_campaign")
      .map((action) => action.currency),
  );
  const reportRiskFlags = [
    ...(input.riskFlags ?? []),
    ...(currencies.length > 1 ? ["MULTI_CURRENCY_PAID_PLAN"] : []),
  ];

  const packetWithoutFingerprint = {
    id: input.id,
    weekStartsAt: input.weekStartsAt,
    weekEndsAt: input.weekEndsAt,
    createdAt,
    campaigns: Object.freeze([...campaignById.values()]),
    actions: Object.freeze(actions),
    report: Object.freeze({
      sections: Object.freeze(sections),
      totalActions: actions.length,
      totalOrganicPublications: actions.filter((a) => a.kind === "organic_publication").length,
      totalPublicComments: actions.filter((a) => a.kind === "public_comment").length,
      totalPaidTests: actions.filter((a) => a.kind === "paid_campaign").length,
      totalDirectorJobs: actions.filter((a) => a.kind === "director_production").length,
      riskFlags: Object.freeze(unique(reportRiskFlags)),
      evidenceRefs: Object.freeze(unique([
        ...input.evidenceRefs,
        ...sections.flatMap((section) => section.evidenceRefs),
      ])),
    }),
    policy: Object.freeze({
      oneWeeklyApprovalMayCoverExactPacket: true as const,
      automaticExecutionOnlyAfterApproval: true as const,
      dynamicActionsAfterApprovalAllowed: false as const,
      postApprovalMutationRequiresReapproval: true as const,
      commentsMustBeRelevantAndProfileBound: true as const,
      massUnsolicitedEngagementAllowed: false as const,
      fakeEngagementAllowed: false as const,
      sensitiveTargetingAllowed: false as const,
      paidBudgetIncreaseAfterApprovalAllowed: false as const,
      directorProductionDoesNotGrantPublishAuthority: true as const,
      directorDerivedMediaMayMaterializeWithinApprovedBrief: true as const,
      generatedMediaMustMatchApprovedBriefAndQc: true as const,
    }),
    authority: "WEEKLY_CAMPAIGN_PROPOSAL_ONLY" as const,
    externalActionAuthorized: false as const,
  };

  return Object.freeze({
    ...packetWithoutFingerprint,
    fingerprint: fingerprintWeeklySocialCampaignPacket(packetWithoutFingerprint),
  });
}

export function fingerprintWeeklySocialCampaignPacket(
  packet: Omit<WeeklySocialCampaignPacket, "fingerprint">,
): string {
  const campaigns = [...packet.campaigns]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((campaign) => [
      campaign.id,
      campaign.brand,
      campaign.profile.characterProfileRef,
      campaign.profile.voiceProfileRef,
      campaign.profile.speakerIdentityRef ?? "",
      campaign.objective,
      campaign.hypothesis,
      [...campaign.ownerIdeaRefs].sort().join(","),
      [...campaign.actionIds].sort().join(","),
    ].join("~"))
    .join("||");

  const actions = [...packet.actions]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(actionFingerprint)
    .join("||");

  return [
    "social-weekly-campaign:v1",
    packet.id,
    packet.weekStartsAt,
    packet.weekEndsAt,
    campaigns,
    actions,
  ].join("::");
}

export function bindApprovedWeeklySocialCampaignPacket(input: {
  packet: WeeklySocialCampaignPacket;
  approvalReceiptId: string;
  approvedFingerprint: string;
}): ApprovedWeeklySocialCampaignPacket {
  requireText(input.approvalReceiptId, "approvalReceiptId");
  requireText(input.approvedFingerprint, "approvedFingerprint");
  if (input.approvedFingerprint !== input.packet.fingerprint) {
    throw new Error("SOCIAL_WEEKLY_APPROVAL_FINGERPRINT_MISMATCH");
  }

  return Object.freeze({
    ...input.packet,
    approvalReceiptId: input.approvalReceiptId,
    approvedFingerprint: input.approvedFingerprint,
    authority: "EXACT_WEEKLY_PACKET_APPROVED" as const,
    externalActionAuthorized: true as const,
  });
}

function validateCampaign(campaign: WeeklySocialCampaign): void {
  requireText(campaign.id, "campaign.id");
  requireText(campaign.name, "campaign.name");
  requireText(campaign.objective, "campaign.objective");
  requireText(campaign.hypothesis, "campaign.hypothesis");
  if (!campaign.actionIds.length) {
    throw new Error("SOCIAL_WEEKLY_CAMPAIGN_ACTION_REQUIRED");
  }
  if (!campaign.evidenceRefs.length) {
    throw new Error("SOCIAL_WEEKLY_CAMPAIGN_EVIDENCE_REQUIRED");
  }
  validateProfile(campaign.profile);
}

function validateAction(
  action: WeeklySocialAction,
  starts: number,
  ends: number,
): void {
  requireText(action.id, "action.id");
  requireText(action.campaignId, "action.campaignId");
  requireDate(action.scheduledAt, "action.scheduledAt");
  const scheduled = Date.parse(action.scheduledAt);
  if (scheduled < starts || scheduled >= ends) {
    throw new Error("SOCIAL_WEEKLY_ACTION_OUTSIDE_WINDOW");
  }
  if (!action.evidenceRefs.length) {
    throw new Error("SOCIAL_WEEKLY_ACTION_EVIDENCE_REQUIRED");
  }
  validateProfile(action.profile);

  switch (action.kind) {
    case "organic_publication":
      requireText(action.target.accountId, "organic.target.accountId");
      requireText(action.target.providerProfileId, "organic.target.providerProfileId");
      requireText(action.contentProjectRef, "organic.contentProjectRef");
      requireText(action.contentAssetRef, "organic.contentAssetRef");
      requireText(action.text, "organic.text");
      if (action.target.brand !== action.brand) {
        throw new Error("SOCIAL_WEEKLY_ORGANIC_BRAND_MISMATCH");
      }
      break;
    case "public_comment":
      requireText(action.accountId, "comment.accountId");
      requireText(action.targetContentRef, "comment.targetContentRef");
      requireText(action.text, "comment.text");
      requireText(action.relevanceReason, "comment.relevanceReason");
      if (!Number.isFinite(action.relevanceScore) || action.relevanceScore < 0 || action.relevanceScore > 100) {
        throw new Error("SOCIAL_WEEKLY_COMMENT_RELEVANCE_INVALID");
      }
      if (action.relevanceScore < 70) {
        throw new Error("SOCIAL_WEEKLY_COMMENT_RELEVANCE_TOO_LOW");
      }
      if (!action.commercialRelevanceEvidenceRefs.length) {
        throw new Error("SOCIAL_WEEKLY_COMMENT_RELEVANCE_EVIDENCE_REQUIRED");
      }
      if (action.promotionLinkRef && action.relevanceScore < 90) {
        throw new Error("SOCIAL_WEEKLY_COMMENT_LINK_REQUIRES_HIGH_RELEVANCE");
      }
      break;
    case "paid_campaign":
      requireText(action.providerAccountId, "paid.providerAccountId");
      requireText(action.objective, "paid.objective");
      if (!action.audienceIds.length) throw new Error("SOCIAL_WEEKLY_PAID_AUDIENCE_REQUIRED");
      if (!action.creativeIds.length) throw new Error("SOCIAL_WEEKLY_PAID_CREATIVE_REQUIRED");
      if (!/^[A-Z]{3}$/.test(action.currency)) {
        throw new Error("SOCIAL_WEEKLY_PAID_CURRENCY_INVALID");
      }
      if (!Number.isSafeInteger(action.dailyBudgetMinor) || action.dailyBudgetMinor <= 0) {
        throw new Error("SOCIAL_WEEKLY_PAID_DAILY_BUDGET_INVALID");
      }
      if (
        action.lifetimeBudgetMinor !== undefined
        && (
          !Number.isSafeInteger(action.lifetimeBudgetMinor)
          || action.lifetimeBudgetMinor < action.dailyBudgetMinor
        )
      ) {
        throw new Error("SOCIAL_WEEKLY_PAID_LIFETIME_BUDGET_INVALID");
      }
      break;
    case "director_production":
      requireText(action.socialContentProjectRef, "director.socialContentProjectRef");
      requireText(action.socialAssetRef, "director.socialAssetRef");
      requireText(action.directorProjectRef, "director.directorProjectRef");
      requireText(action.productionBriefRef, "director.productionBriefRef");
      requireDate(action.requiredBy, "director.requiredBy");
      if (Date.parse(action.requiredBy) > Date.parse(action.scheduledAt)) {
        throw new Error("SOCIAL_WEEKLY_DIRECTOR_REQUIRED_AFTER_SCHEDULE");
      }
      break;
  }
}

function validateProfile(profile: SocialProfileIdentityBinding): void {
  requireText(profile.characterProfileRef, "profile.characterProfileRef");
  requireText(profile.voiceProfileRef, "profile.voiceProfileRef");
  if (profile.speakerIdentityRef !== undefined) {
    requireText(profile.speakerIdentityRef, "profile.speakerIdentityRef");
  }
  if (!profile.evidenceRefs.length) {
    throw new Error("SOCIAL_WEEKLY_PROFILE_EVIDENCE_REQUIRED");
  }
}

function assertSameProfile(
  expected: SocialProfileIdentityBinding,
  actual: SocialProfileIdentityBinding,
): void {
  if (
    expected.characterProfileRef !== actual.characterProfileRef
    || expected.voiceProfileRef !== actual.voiceProfileRef
    || (expected.speakerIdentityRef ?? "") !== (actual.speakerIdentityRef ?? "")
  ) {
    throw new Error("SOCIAL_WEEKLY_PROFILE_MISMATCH");
  }
}

function buildReportSection(
  campaign: WeeklySocialCampaign,
  actions: readonly WeeklySocialAction[],
): WeeklySocialReportSection {
  const rows = actions.filter((action) => action.campaignId === campaign.id);
  const paid = rows.filter(
    (action): action is WeeklyPaidCampaignAction => action.kind === "paid_campaign",
  );
  const currencies = unique(paid.map((action) => action.currency));
  return Object.freeze({
    campaignId: campaign.id,
    brand: campaign.brand,
    plannedActions: rows.length,
    organicPublications: rows.filter((a) => a.kind === "organic_publication").length,
    publicComments: rows.filter((a) => a.kind === "public_comment").length,
    paidTests: paid.length,
    directorJobs: rows.filter((a) => a.kind === "director_production").length,
    plannedPaidBudgetMinor: paid.reduce(
      (sum, action) => sum + (action.lifetimeBudgetMinor ?? action.dailyBudgetMinor),
      0,
    ),
    currency: currencies.length === 1 ? currencies[0] : undefined,
    hypotheses: Object.freeze([campaign.hypothesis]),
    ownerIdeaRefs: Object.freeze([...campaign.ownerIdeaRefs]),
    evidenceRefs: Object.freeze(unique([
      ...campaign.evidenceRefs,
      ...campaign.profile.evidenceRefs,
      ...rows.flatMap((action) => action.evidenceRefs),
    ])),
  });
}

function actionFingerprint(action: WeeklySocialAction): string {
  const base = [
    action.id,
    action.campaignId,
    action.brand,
    action.kind,
    action.profile.characterProfileRef,
    action.profile.voiceProfileRef,
    action.profile.speakerIdentityRef ?? "",
    action.scheduledAt,
    action.commercialLineageRef ?? "",
  ];

  switch (action.kind) {
    case "organic_publication":
      return [...base,
        action.target.accountId,
        action.target.provider,
        action.target.providerProfileId,
        action.target.platform,
        action.contentProjectRef,
        action.contentAssetRef,
        action.text,
        [...action.mediaRefs].sort().join(","),
        action.destinationRef ?? "",
      ].join("~");
    case "public_comment":
      return [...base,
        action.platform,
        action.accountId,
        action.targetContentRef,
        action.targetCreatorRef ?? "",
        action.text,
        String(action.relevanceScore),
        action.relevanceReason,
        action.promotionLinkRef ?? "",
      ].join("~");
    case "paid_campaign":
      return [...base,
        action.channel,
        action.providerAccountId,
        action.objective,
        [...action.audienceIds].sort().join(","),
        [...action.creativeIds].sort().join(","),
        action.landingPageRef ?? "",
        action.currency,
        String(action.dailyBudgetMinor),
        String(action.lifetimeBudgetMinor ?? ""),
        action.experimentRef ?? "",
      ].join("~");
    case "director_production":
      return [...base,
        action.socialContentProjectRef,
        action.socialAssetRef,
        action.directorProjectRef,
        action.productionBriefRef,
        action.requiredBy,
        action.experimentVariantRef ?? "",
      ].join("~");
  }
}

function freezeCampaign(campaign: WeeklySocialCampaign): WeeklySocialCampaign {
  return Object.freeze({
    ...campaign,
    profile: freezeProfile(campaign.profile),
    ownerIdeaRefs: Object.freeze([...campaign.ownerIdeaRefs]),
    actionIds: Object.freeze([...campaign.actionIds]),
    evidenceRefs: Object.freeze([...campaign.evidenceRefs]),
  });
}

function freezeAction(action: WeeklySocialAction): WeeklySocialAction {
  const base = {
    ...action,
    profile: freezeProfile(action.profile),
    evidenceRefs: Object.freeze([...action.evidenceRefs]),
  };
  switch (action.kind) {
    case "organic_publication":
      return Object.freeze({
        ...base,
        kind: "organic_publication" as const,
        target: Object.freeze({ ...action.target }),
        mediaRefs: Object.freeze([...action.mediaRefs]),
      });
    case "public_comment":
      return Object.freeze({
        ...base,
        kind: "public_comment" as const,
        commercialRelevanceEvidenceRefs: Object.freeze([
          ...action.commercialRelevanceEvidenceRefs,
        ]),
      });
    case "paid_campaign":
      return Object.freeze({
        ...base,
        kind: "paid_campaign" as const,
        audienceIds: Object.freeze([...action.audienceIds]),
        creativeIds: Object.freeze([...action.creativeIds]),
      });
    case "director_production":
      return Object.freeze({
        ...base,
        kind: "director_production" as const,
      });
  }
}

function freezeProfile(
  profile: SocialProfileIdentityBinding,
): SocialProfileIdentityBinding {
  return Object.freeze({
    ...profile,
    evidenceRefs: Object.freeze([...profile.evidenceRefs]),
  });
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`SOCIAL_WEEKLY_FIELD_REQUIRED:${field}`);
}

function requireDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`SOCIAL_WEEKLY_DATE_INVALID:${field}`);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
