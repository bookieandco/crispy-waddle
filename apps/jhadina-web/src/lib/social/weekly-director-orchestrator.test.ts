import { describe, expect, it } from "vitest";
import {
  bindApprovedWeeklySocialCampaignPacket,
  compileWeeklySocialCampaignPacket,
  createContentProject,
  type WeeklyDirectorProductionAction,
  type WeeklySocialCampaign,
} from "@jhadina/social-core";
import { compileApprovedWeeklyDirectorQueue } from "./weekly-director-orchestrator";

const project = createContentProject({
  id: "project:pupson:weekly",
  brand: "pupsonstuff",
  authorityPositionRef: "authority:pupson",
  pillarRef: "pillar:pet-identity",
  bigIdeaRef: "big-idea:pupson:weekly",
  primaryJob: "conversion",
  origin: "ai_generated",
  characterProfileRef: "character:pupsonstuff",
  voiceProfileRef: "brand-voice:pupsonstuff",
  evidenceRefs: ["project:evidence"],
  anchor: {
    id: "asset:pupson:weekly",
    kind: "short_video",
    platform: "instagram",
    transformation: "original",
    text: "Synthetic approved creative brief.",
    mediaRefs: [],
    evidenceRefs: ["asset:evidence"],
  },
  createdAt: "2026-10-11T17:00:00.000Z",
});

const action: WeeklyDirectorProductionAction = {
  id: "action:director:weekly",
  campaignId: "campaign:pupson:weekly",
  brand: "pupsonstuff",
  kind: "director_production",
  profile: {
    characterProfileRef: "character:pupsonstuff",
    voiceProfileRef: "brand-voice:pupsonstuff",
    evidenceRefs: ["profile:evidence"],
  },
  scheduledAt: "2026-10-13T16:00:00.000Z",
  socialContentProjectRef: project.id,
  socialAssetRef: project.assets[0]!.id,
  directorProjectRef: "director:pupson:weekly",
  productionBriefRef:
    "social:project:pupson:weekly:asset:pupson:weekly",
  requiredBy: "2026-10-13T16:00:00.000Z",
  experimentVariantRef: "variant:pupson:a",
  evidenceRefs: ["director:weekly"],
};

const campaign: WeeklySocialCampaign = {
  id: "campaign:pupson:weekly",
  brand: "pupsonstuff",
  name: "PupsonStuff weekly",
  profile: action.profile,
  objective: "Produce one approved weekly creative.",
  hypothesis: "The approved native short-video brief will improve qualified sales.",
  ownerIdeaRefs: ["owner-idea:pupson"],
  actionIds: [action.id],
  evidenceRefs: ["campaign:evidence"],
};

function approvedPacket() {
  const packet = compileWeeklySocialCampaignPacket({
    id: "weekly:pupson:2026-10-12",
    ownerUserId: "user:owner",
    weekStartsAt: "2026-10-12T00:00:00.000Z",
    weekEndsAt: "2026-10-19T00:00:00.000Z",
    createdAt: "2026-10-11T18:00:00.000Z",
    campaigns: [campaign],
    actions: [action],
    evidenceRefs: ["weekly:evidence"],
  });
  return bindApprovedWeeklySocialCampaignPacket({
    packet,
    approvalReceiptId: "approval:weekly:pupson",
    approvedFingerprint: packet.fingerprint,
    approvedByUserId: "user:owner",
    approvedAt: "2026-10-11T19:00:00.000Z",
  });
}

describe("weekly Director orchestration", () => {
  it("queues only the exact preapproved Social content project and brief", () => {
    const queue = compileApprovedWeeklyDirectorQueue({
      packet: approvedPacket(),
      bindings: [{
        actionId: action.id,
        contentProject: project,
        mediaType: "video",
        aspectRatio: "9:16",
        targetRuntimeSeconds: 18,
      }],
    });

    expect(queue).toHaveLength(1);
    expect(queue[0]?.actionId).toBe(action.id);
    expect(queue[0]?.brief.id).toBe(action.productionBriefRef);
    expect(queue[0]?.brief.socialContentProjectId).toBe(project.id);
    expect(queue[0]?.brief.socialAssetId).toBe(project.assets[0]!.id);
    expect(queue[0]?.weeklyApprovalReceiptId).toBe(
      "approval:weekly:pupson",
    );
    expect(queue[0]?.publicationAuthority).toBe("NONE");
  });

  it("rejects a different content project", () => {
    expect(() => compileApprovedWeeklyDirectorQueue({
      packet: approvedPacket(),
      bindings: [{
        actionId: action.id,
        contentProject: {
          ...project,
          id: "project:other",
        },
      }],
    })).toThrow(/PROJECT_MISMATCH/);
  });

  it("rejects a profile identity mismatch", () => {
    expect(() => compileApprovedWeeklyDirectorQueue({
      packet: approvedPacket(),
      bindings: [{
        actionId: action.id,
        contentProject: {
          ...project,
          characterProfileRef: "character:atwood-bookie",
        },
      }],
    })).toThrow(/PROFILE_MISMATCH/);
  });

  it("rejects a production brief that was not in the approved packet", () => {
    const changedAction = {
      ...action,
      productionBriefRef: "social:other:brief",
    };
    const changedCampaign = {
      ...campaign,
      actionIds: [changedAction.id],
    };
    const packet = compileWeeklySocialCampaignPacket({
      id: "weekly:pupson:bad-brief",
      ownerUserId: "user:owner",
      weekStartsAt: "2026-10-12T00:00:00.000Z",
      weekEndsAt: "2026-10-19T00:00:00.000Z",
      createdAt: "2026-10-11T18:00:00.000Z",
      campaigns: [changedCampaign],
      actions: [changedAction],
      evidenceRefs: ["weekly:evidence"],
    });
    const approved = bindApprovedWeeklySocialCampaignPacket({
      packet,
      approvalReceiptId: "approval:weekly:bad-brief",
      approvedFingerprint: packet.fingerprint,
      approvedByUserId: "user:owner",
      approvedAt: "2026-10-11T19:00:00.000Z",
    });

    expect(() => compileApprovedWeeklyDirectorQueue({
      packet: approved,
      bindings: [{
        actionId: changedAction.id,
        contentProject: project,
      }],
    })).toThrow(/BRIEF_FINGERPRINT_MISMATCH/);
  });
});
