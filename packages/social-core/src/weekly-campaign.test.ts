import { describe, expect, it } from "vitest";
import {
  bindApprovedWeeklySocialCampaignPacket,
  compileWeeklySocialCampaignPacket,
  type SocialProfileIdentityBinding,
  type WeeklySocialAction,
  type WeeklySocialCampaign,
} from "./weekly-campaign.js";

const profile: SocialProfileIdentityBinding = {
  characterProfileRef: "character:pupsonstuff",
  voiceProfileRef: "brand-voice:pupsonstuff",
  evidenceRefs: ["profile:pupsonstuff"],
};

const actions: WeeklySocialAction[] = [
  {
    id: "action:director:1",
    campaignId: "campaign:pupson:week",
    brand: "pupsonstuff",
    kind: "director_production",
    profile,
    scheduledAt: "2026-10-13T16:00:00.000Z",
    socialContentProjectRef: "social-project:pupson:1",
    socialAssetRef: "social-asset:pupson:1",
    directorProjectRef: "director:pupson:1",
    productionBriefRef: "director-brief:pupson:1",
    requiredBy: "2026-10-12T16:00:00.000Z",
    experimentVariantRef: "variant:pupson:a",
    evidenceRefs: ["brief:pupson"],
  },
  {
    id: "action:organic:1",
    campaignId: "campaign:pupson:week",
    brand: "pupsonstuff",
    kind: "organic_publication",
    profile,
    scheduledAt: "2026-10-14T17:00:00.000Z",
    target: {
      accountId: "account:pupson:instagram",
      brand: "pupsonstuff",
      provider: "hootsuite",
      providerProfileId: "profile:ig:pupson",
      platform: "instagram",
    },
    contentProjectRef: "social-project:pupson:1",
    contentAssetRef: "social-asset:pupson:1",
    text: "Synthetic approved campaign copy.",
    mediaRefs: ["media:pupson:1"],
    destinationRef: "storefront:pupsonstuff",
    commercialLineageRef: "lineage:pupson:1",
    evidenceRefs: ["product:pupson", "creative:pupson"],
  },
  {
    id: "action:comment:1",
    campaignId: "campaign:pupson:week",
    brand: "pupsonstuff",
    kind: "public_comment",
    profile,
    scheduledAt: "2026-10-15T18:00:00.000Z",
    platform: "instagram",
    accountId: "account:pupson:instagram",
    targetContentRef: "instagram:post:pet-topic",
    targetCreatorRef: "creator:pet-account",
    text: "Synthetic relevant profile-voice comment.",
    relevanceScore: 92,
    relevanceReason: "The public post topic directly overlaps the brand audience and approved campaign.",
    commercialRelevanceEvidenceRefs: ["audience:pet-topic", "brand:pupsonstuff"],
    evidenceRefs: ["radar:pet-topic"],
  },
  {
    id: "action:paid:1",
    campaignId: "campaign:pupson:week",
    brand: "pupsonstuff",
    kind: "paid_campaign",
    profile,
    growthBrandId: "brand:pupsonstuff",
    campaignName: "PupsonStuff Meta creative test",
    idempotencyKey: "weekly:pupson:meta:creative:1",
    scheduledAt: "2026-10-16T16:00:00.000Z",
    channel: "meta",
    providerAccountId: "meta-account:pupson",
    objective: "sales",
    audienceIds: ["audience:pupson:high-intent", "audience:pupson:lookalike"],
    creativeIds: ["creative:pupson:control", "creative:pupson:treatment"],
    landingPageRef: "storefront:pupsonstuff",
    currency: "USD",
    dailyBudgetMinor: 2500,
    lifetimeBudgetMinor: 10000,
    startsAt: "2026-10-16T16:00:00.000Z",
    endsAt: "2026-10-18T23:00:00.000Z",
    experimentRef: "experiment:pupson:meta:1",
    evidenceRefs: ["audience:pupson", "experiment:pupson"],
  },
];

const campaign: WeeklySocialCampaign = {
  id: "campaign:pupson:week",
  brand: "pupsonstuff",
  name: "PupsonStuff weekly growth",
  profile,
  objective: "Drive qualified product sales without sacrificing brand identity.",
  hypothesis: "Relevant creative plus high-intent and lookalike Meta audiences will outperform the current control on contribution-positive sales.",
  ownerIdeaRefs: ["owner-idea:pet-product"],
  actionIds: actions.map((action) => action.id),
  evidenceRefs: ["campaign:pupson:evidence"],
};

describe("weekly governed Social campaign packet", () => {
  it("binds production, organic, comments and paid tests into one exact weekly approval packet", () => {
    const packet = compileWeeklySocialCampaignPacket({
      id: "weekly-social:2026-10-12",
      ownerUserId: "user:owner",
      weekStartsAt: "2026-10-12T00:00:00.000Z",
      weekEndsAt: "2026-10-19T00:00:00.000Z",
      createdAt: "2026-10-11T19:00:00.000Z",
      campaigns: [campaign],
      actions,
      riskFlags: ["PAID_SPEND_PRESENT"],
      evidenceRefs: ["weekly-planning:2026-10-12"],
    });

    expect(packet.report.totalActions).toBe(4);
    expect(packet.report.totalDirectorJobs).toBe(1);
    expect(packet.report.totalOrganicPublications).toBe(1);
    expect(packet.report.totalPublicComments).toBe(1);
    expect(packet.report.totalPaidTests).toBe(1);
    expect(packet.report.sections[0]?.plannedPaidBudgetMinor).toBe(10000);
    expect(packet.policy.oneWeeklyApprovalMayCoverExactPacket).toBe(true);
    expect(packet.policy.dynamicActionsAfterApprovalAllowed).toBe(false);
    expect(packet.externalActionAuthorized).toBe(false);
  });

  it("binds one approval receipt only to the exact packet fingerprint", () => {
    const packet = compileWeeklySocialCampaignPacket({
      id: "weekly-social:2026-10-12",
      ownerUserId: "user:owner",
      weekStartsAt: "2026-10-12T00:00:00.000Z",
      weekEndsAt: "2026-10-19T00:00:00.000Z",
      campaigns: [campaign],
      actions,
      evidenceRefs: ["weekly-planning:2026-10-12"],
    });

    const approved = bindApprovedWeeklySocialCampaignPacket({
      packet,
      approvalReceiptId: "approval:weekly:1",
      approvedFingerprint: packet.fingerprint,
      approvedByUserId: "user:owner",
      approvedAt: "2026-10-11T20:00:00.000Z",
    });

    expect(approved.externalActionAuthorized).toBe(true);
    expect(approved.authority).toBe("EXACT_WEEKLY_PACKET_APPROVED");

    expect(() => bindApprovedWeeklySocialCampaignPacket({
      packet,
      approvalReceiptId: "approval:weekly:2",
      approvedFingerprint: packet.fingerprint + ":mutated",
      approvedByUserId: "user:owner",
      approvedAt: "2026-10-11T20:00:00.000Z",
    })).toThrow(/FINGERPRINT_MISMATCH/);
  });

  it("rejects low-relevance public comments", () => {
    const bad = actions.map((action) =>
      action.kind === "public_comment"
        ? { ...action, relevanceScore: 40 }
        : action,
    ) as WeeklySocialAction[];

    expect(() => compileWeeklySocialCampaignPacket({
      id: "weekly-social:bad-comment",
      ownerUserId: "user:owner",
      weekStartsAt: "2026-10-12T00:00:00.000Z",
      weekEndsAt: "2026-10-19T00:00:00.000Z",
      campaigns: [{ ...campaign, actionIds: bad.map((action) => action.id) }],
      actions: bad,
      evidenceRefs: ["weekly-planning:bad"],
    })).toThrow(/COMMENT_RELEVANCE_TOO_LOW/);
  });

  it("changes the packet fingerprint when budget/content/schedule changes", () => {
    const packet = compileWeeklySocialCampaignPacket({
      id: "weekly-social:2026-10-12",
      ownerUserId: "user:owner",
      weekStartsAt: "2026-10-12T00:00:00.000Z",
      weekEndsAt: "2026-10-19T00:00:00.000Z",
      campaigns: [campaign],
      actions,
      evidenceRefs: ["weekly-planning:2026-10-12"],
    });

    const mutated = actions.map((action) =>
      action.kind === "paid_campaign"
        ? { ...action, dailyBudgetMinor: action.dailyBudgetMinor + 500 }
        : action,
    ) as WeeklySocialAction[];

    const changed = compileWeeklySocialCampaignPacket({
      id: "weekly-social:2026-10-12",
      ownerUserId: "user:owner",
      weekStartsAt: "2026-10-12T00:00:00.000Z",
      weekEndsAt: "2026-10-19T00:00:00.000Z",
      campaigns: [campaign],
      actions: mutated,
      evidenceRefs: ["weekly-planning:2026-10-12"],
    });

    expect(changed.fingerprint).not.toBe(packet.fingerprint);
  });

  it("requires the exact profile identity on every campaign action", () => {
    const mismatched = actions.map((action) =>
      action.kind === "organic_publication"
        ? {
            ...action,
            profile: {
              ...profile,
              characterProfileRef: "character:atwood-bookie",
            },
          }
        : action,
    ) as WeeklySocialAction[];

    expect(() => compileWeeklySocialCampaignPacket({
      id: "weekly-social:profile-mismatch",
      ownerUserId: "user:owner",
      weekStartsAt: "2026-10-12T00:00:00.000Z",
      weekEndsAt: "2026-10-19T00:00:00.000Z",
      campaigns: [campaign],
      actions: mismatched,
      evidenceRefs: ["weekly-planning:profile-mismatch"],
    })).toThrow(/PROFILE_MISMATCH/);
  });
});
