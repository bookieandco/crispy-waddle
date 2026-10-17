import { describe, expect, it } from "vitest";
import {
  bindApprovedWeeklySocialCampaignPacket,
  compileWeeklySocialCampaignPacket,
  type WeeklyDirectorProductionAction,
  type WeeklyOrganicPublicationAction,
  type WeeklySocialCampaign,
} from "@jhadina/social-core";
import {
  assertWeeklyPublicationProposalBinding,
  materializeWeeklyOrganicPublication,
} from "./weekly-publication-materialization";

const profile = {
  characterProfileRef: "character:pupsonstuff",
  voiceProfileRef: "brand-voice:pupsonstuff",
  evidenceRefs: ["profile:pupsonstuff"],
};

const director: WeeklyDirectorProductionAction = {
  id: "action:director:1",
  campaignId: "campaign:pupson",
  brand: "pupsonstuff",
  kind: "director_production",
  profile,
  scheduledAt: "2026-10-13T16:00:00.000Z",
  socialContentProjectRef: "project:pupson:1",
  socialAssetRef: "asset:pupson:1",
  directorProjectRef: "director:pupson:1",
  productionBriefRef: "social:project:pupson:1:asset:pupson:1",
  requiredBy: "2026-10-13T16:00:00.000Z",
  evidenceRefs: ["director:brief"],
};

const publication: WeeklyOrganicPublicationAction = {
  id: "action:organic:1",
  campaignId: "campaign:pupson",
  brand: "pupsonstuff",
  kind: "organic_publication",
  profile,
  scheduledAt: "2026-10-14T17:00:00.000Z",
  target: {
    accountId: "account:pupson:ig",
    brand: "pupsonstuff",
    provider: "ayrshare",
    providerProfileId: "provider:pupson:ig",
    platform: "instagram",
  },
  contentProjectRef: "project:pupson:1",
  contentAssetRef: "asset:pupson:1",
  text: "Synthetic scheduled copy.",
  mediaRefs: [],
  directorOutput: {
    directorActionId: director.id,
    productionBriefRef: director.productionBriefRef,
    socialAssetRef: director.socialAssetRef,
  },
  evidenceRefs: ["social:creative"],
};

const campaign: WeeklySocialCampaign = {
  id: "campaign:pupson",
  brand: "pupsonstuff",
  name: "Pupson weekly campaign",
  profile,
  objective: "Drive qualified product traffic.",
  hypothesis: "Short native video will outperform the control.",
  ownerIdeaRefs: ["owner:idea:1"],
  actionIds: [director.id, publication.id],
  evidenceRefs: ["campaign:evidence"],
};

function packet() {
  const proposed = compileWeeklySocialCampaignPacket({
    id: "weekly:2026-10-12",
    ownerUserId: "user:owner",
    weekStartsAt: "2026-10-12T00:00:00.000Z",
    weekEndsAt: "2026-10-19T00:00:00.000Z",
    createdAt: "2026-10-11T18:00:00.000Z",
    campaigns: [campaign],
    actions: [director, publication],
    evidenceRefs: ["weekly:evidence"],
  });
  return bindApprovedWeeklySocialCampaignPacket({
    packet: proposed,
    approvalReceiptId: "approval:weekly:1",
    approvedFingerprint: proposed.fingerprint,
    approvedByUserId: "user:owner",
    approvedAt: "2026-10-11T19:00:00.000Z",
  });
}

const receipt = {
  id: "director-receipt:1",
  briefId: director.productionBriefRef,
  socialContentProjectId: director.socialContentProjectRef,
  socialAssetId: director.socialAssetRef,
  directorProjectId: director.directorProjectRef,
  directorAssetId: "director-asset:1",
  uri: "https://media.example/approved.mp4",
  reviewDecisionId: "review:1",
  reviewEvidenceIds: ["qc:watch:1"],
  approvedAt: "2026-10-13T15:00:00.000Z",
  authority: "DIRECTOR_ASSET_APPROVED" as const,
  publicationAuthority: "NONE" as const,
};

describe("weekly Director output materialization", () => {
  it("fills only the preapproved Director output slot", () => {
    const approved = packet();
    const materialized = materializeWeeklyOrganicPublication({
      packet: approved,
      action: publication,
      directorReceipt: receipt,
    });

    expect(materialized.mediaUrls).toEqual([receipt.uri]);
    expect(materialized.directorActionId).toBe(director.id);
    expect(materialized.directorReceiptId).toBe(receipt.id);
    expect(materialized.publicationAuthority).toBe("NONE");
    expect(materialized.requestFingerprint).toContain("approved.mp4");
  });

  it("binds the resulting payload to Social's normal exact proposal fingerprint", () => {
    const approved = packet();
    const materialized = materializeWeeklyOrganicPublication({
      packet: approved,
      action: publication,
      directorReceipt: receipt,
    });

    expect(() => assertWeeklyPublicationProposalBinding({
      packet: approved,
      action: publication,
      materialized,
      proposal: {
        id: "proposal:1",
        userId: "user:owner",
        actionId: "social-public-publish:1",
        brand: "pupsonstuff",
        text: publication.text,
        mediaUrls: [receipt.uri],
        scheduledAt: publication.scheduledAt,
        targets: [publication.target],
        status: "pending_approval",
        requestFingerprint: materialized.requestFingerprint,
        idempotencyKey: "weekly:proposal:1",
        approvalReceiptId: "social-approval:1",
        createdAt: "2026-10-13T15:01:00.000Z",
        updatedAt: "2026-10-13T15:01:00.000Z",
      },
    })).not.toThrow();
  });

  it("rejects a Director receipt from another brief", () => {
    expect(() => materializeWeeklyOrganicPublication({
      packet: packet(),
      action: publication,
      directorReceipt: { ...receipt, briefId: "social:other:asset" },
    })).toThrow(/RECEIPT_LINEAGE_MISMATCH/);
  });

  it("rejects a changed Social schedule even with a valid Director receipt", () => {
    expect(() => materializeWeeklyOrganicPublication({
      packet: packet(),
      action: {
        ...publication,
        scheduledAt: "2026-10-15T17:00:00.000Z",
      },
      directorReceipt: receipt,
    })).toThrow(/ACTION_MUTATED/);
  });
});
