import { describe, expect, it } from "vitest";
import {
  createRelayBrandBrief, generateRelayDraftBatch, rankRelayTrends,
  reviewRelayDraft, planRelayCalendar,
} from "./relay-workbench.js";
import type { SocialAccount } from "./types.js";
import { validateSocialStudioWorkspace } from "./studio-workspace.js";

const now = "2026-10-21T12:00:00.000Z";
const owner = "11111111-1111-4111-8111-111111111111";
const brand = "pupsonstuff";
const account: SocialAccount = {
  id: "22222222-2222-4222-8222-222222222222", userId: owner,
  brand, provider: "hootsuite", providerProfileId: "pupson-profile",
  platform: "instagram", displayName: "PupsonStuff", status: "connected",
  createdAt: now, updatedAt: now,
};
function workspace() {
  const brief = createRelayBrandBrief({
    id: "brief", ownerUserId: owner, brand,
    siteUrl: "https://pupsonstuff.example", positioning: "Original pet keepsakes",
    audience: "Dog owners", offer: "portraits", keywords: ["dog"],
    evidenceRefs: ["owner-evidence"], provenance: "owner_supplied", createdAt: now,
  });
  const trends = rankRelayTrends(brief, [{
    id: "trend1", platform: "instagram", format: "short_video",
    topic: "dog portrait gift", pattern: "reveal",
    sourceUrl: "https://example.com/dog", observedAt: now,
    evidenceRefs: ["owner-reference"], source: "owner_submitted",
  }], now);
  const initial = generateRelayDraftBatch({ brief, trends, count: 1, now })[0];
  const draft = reviewRelayDraft(initial, "accept", owner, now);
  const slots = planRelayCalendar({
    brief, drafts: [draft], accounts: [account],
    targetAccountByDraftId: { [draft.id]: account.id },
    firstScheduledAt: "2026-10-23T12:00:00.000Z", now,
  });
  return { brief, drafts: [draft], slots };
}

describe("social workspace durable planning contract", () => {
  it("admits a bounded exact-owner non-executable plan", () => {
    const value = workspace();
    expect(validateSocialStudioWorkspace(value, owner, brand, [account])).toBe(value);
  });
  it("rejects cross-owner and cross-brand identity", () => {
    expect(() => validateSocialStudioWorkspace(workspace(), "different", brand, [account])).toThrow("OWNER_BRAND_MISMATCH");
    expect(() => validateSocialStudioWorkspace(workspace(), owner, "jhadina", [account])).toThrow("OWNER_BRAND_MISMATCH");
  });
  it("refuses owner-forged publication authority and a foreign destination", () => {
    const value = workspace();
    const slots = value.slots.map((s) => ({ ...s, isQueued: true as false }));
    expect(() => validateSocialStudioWorkspace({ ...value, slots }, owner, brand, [account]))
      .toThrow("SOCIAL_STUDIO_SLOT_IS_NOT_PERMISSION");
    expect(() => validateSocialStudioWorkspace(value, owner, brand, [{ ...account, userId: "different" }]))
      .toThrow("SOCIAL_STUDIO_SLOT_ACCOUNT_MISMATCH");
  });
  it("refuses synthetic reviewed status with a mismatched reviewer", () => {
    const value = workspace();
    const drafts = value.drafts.map((d) => ({ ...d, reviewerId: "different" }));
    expect(() => validateSocialStudioWorkspace({ ...value, drafts }, owner, brand, [account]))
      .toThrow("SOCIAL_STUDIO_REVIEW_OWNER_MISMATCH");
  });
});
