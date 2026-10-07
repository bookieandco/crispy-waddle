import { describe, expect, it } from "vitest";
import {
  bindApprovedWeeklySocialCampaignPacket,
  compileWeeklySocialCampaignPacket,
  type WeeklySocialAction,
  type WeeklySocialCampaign,
} from "./weekly-campaign.js";
import {
  compileWeeklyDelegationManifest,
  consumeWeeklyDelegatedAction,
  type WeeklyDelegationConsumptionStore,
} from "./weekly-delegation.js";

const action: WeeklySocialAction = {
  id: "action:organic:1",
  campaignId: "campaign:test",
  brand: "pupsonstuff",
  kind: "organic_publication",
  profile: {
    characterProfileRef: "character:pupsonstuff",
    voiceProfileRef: "brand-voice:pupsonstuff",
    evidenceRefs: ["profile:test"],
  },
  scheduledAt: "2026-10-14T17:00:00.000Z",
  target: {
    accountId: "account:pupson:instagram",
    brand: "pupsonstuff",
    provider: "hootsuite",
    providerProfileId: "provider-profile:pupson",
    platform: "instagram",
  },
  contentProjectRef: "project:test",
  contentAssetRef: "asset:test",
  text: "Synthetic scheduled copy.",
  mediaRefs: ["media:test"],
  evidenceRefs: ["evidence:test"],
};

const campaign: WeeklySocialCampaign = {
  id: "campaign:test",
  brand: "pupsonstuff",
  name: "Test campaign",
  profile: action.profile,
  objective: "Test exact weekly authority.",
  hypothesis: "Exact scheduled action remains immutable.",
  ownerIdeaRefs: ["owner-idea:test"],
  actionIds: [action.id],
  evidenceRefs: ["campaign:evidence"],
};

function approvedPacket() {
  const packet = compileWeeklySocialCampaignPacket({
    id: "weekly:test",
    ownerUserId: "user:owner",
    weekStartsAt: "2026-10-12T00:00:00.000Z",
    weekEndsAt: "2026-10-19T00:00:00.000Z",
    createdAt: "2026-10-11T19:00:00.000Z",
    campaigns: [campaign],
    actions: [action],
    evidenceRefs: ["weekly:evidence"],
  });
  return bindApprovedWeeklySocialCampaignPacket({
    packet,
    approvalReceiptId: "approval:weekly:test",
    approvedFingerprint: packet.fingerprint,
    approvedByUserId: "user:owner",
    approvedAt: "2026-10-11T20:00:00.000Z",
  });
}

class OnceStore implements WeeklyDelegationConsumptionStore {
  private readonly used = new Set<string>();
  async consume(input: { permitId: string }): Promise<boolean> {
    if (this.used.has(input.permitId)) return false;
    this.used.add(input.permitId);
    return true;
  }
}

describe("weekly child action permits", () => {
  it("derives one exact permit per action from the owner-approved packet", () => {
    const packet = approvedPacket();
    const manifest = compileWeeklyDelegationManifest(packet);

    expect(manifest.permits).toHaveLength(1);
    expect(manifest.permits[0]?.actionId).toBe(action.id);
    expect(manifest.permits[0]?.domain).toBe("social_publication");
    expect(manifest.permits[0]?.ownerUserId).toBe("user:owner");
    expect(manifest.policy.permitCannotChangeSchedule).toBe(true);
  });

  it("consumes an exact permit only once", async () => {
    const packet = approvedPacket();
    const manifest = compileWeeklyDelegationManifest(packet);
    const permit = manifest.permits[0]!;
    const store = new OnceStore();

    await expect(consumeWeeklyDelegatedAction({
      packet,
      permit,
      action,
      ownerUserId: "user:owner",
      consumedAt: "2026-10-13T18:00:00.000Z",
      store,
    })).resolves.toBeUndefined();

    await expect(consumeWeeklyDelegatedAction({
      packet,
      permit,
      action,
      ownerUserId: "user:owner",
      consumedAt: "2026-10-13T18:01:00.000Z",
      store,
    })).rejects.toThrow(/ALREADY_CONSUMED/);
  });

  it("rejects a mutated child action even though the parent packet was approved", async () => {
    const packet = approvedPacket();
    const permit = compileWeeklyDelegationManifest(packet).permits[0]!;
    const changed = {
      ...action,
      scheduledAt: "2026-10-15T17:00:00.000Z",
    } as WeeklySocialAction;

    await expect(consumeWeeklyDelegatedAction({
      packet,
      permit,
      action: changed,
      ownerUserId: "user:owner",
      consumedAt: "2026-10-13T18:00:00.000Z",
      store: new OnceStore(),
    })).rejects.toThrow(/ACTION_FINGERPRINT_MISMATCH/);
  });

  it("rejects a different owner", async () => {
    const packet = approvedPacket();
    const permit = compileWeeklyDelegationManifest(packet).permits[0]!;

    await expect(consumeWeeklyDelegatedAction({
      packet,
      permit,
      action,
      ownerUserId: "user:other",
      consumedAt: "2026-10-13T18:00:00.000Z",
      store: new OnceStore(),
    })).rejects.toThrow(/OWNER_MISMATCH/);
  });
});
