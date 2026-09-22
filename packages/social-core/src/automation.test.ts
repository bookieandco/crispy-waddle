import { describe, expect, it } from "vitest";
import { buildSocialAutomationManifest, nextAutomationEntries } from "./automation.js";
import type { SocialPublicationProposal } from "./types.js";

function proposal(overrides: Partial<SocialPublicationProposal> = {}): SocialPublicationProposal {
  return {
    id: "proposal-1",
    userId: "user-1",
    actionId: "action-1",
    brand: "jhadina",
    text: "Approved text",
    mediaUrls: [],
    scheduledAt: "2026-09-23T12:00:00.000Z",
    targets: [{
      accountId: "acct-1",
      brand: "jhadina",
      provider: "hootsuite",
      providerProfileId: "profile-1",
      platform: "linkedin",
    }],
    status: "approved",
    requestFingerprint: "fingerprint",
    idempotencyKey: "idem",
    approvalReceiptId: "receipt-1",
    createdAt: "2026-09-22T12:00:00.000Z",
    updatedAt: "2026-09-22T12:00:00.000Z",
    ...overrides,
  };
}

describe("social automation manifests", () => {
  it("accepts only exact approved future publications", () => {
    const manifest = buildSocialAutomationManifest(
      "manifest-1",
      [proposal()],
      new Date("2026-09-22T12:00:00.000Z"),
    );
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0].approvalReceiptId).toBe("receipt-1");
  });

  it("rejects unapproved content", () => {
    expect(() => buildSocialAutomationManifest(
      "manifest-1",
      [proposal({ status: "pending_approval" })],
      new Date("2026-09-22T12:00:00.000Z"),
    )).toThrow("SOCIAL_AUTOMATION_REQUIRES_APPROVED_PROPOSAL");
  });

  it("selects due entries within a bounded lookahead", () => {
    const manifest = buildSocialAutomationManifest(
      "manifest-1",
      [proposal({ scheduledAt: "2026-09-22T12:04:00.000Z" })],
      new Date("2026-09-22T12:00:00.000Z"),
    );
    expect(nextAutomationEntries(
      manifest,
      new Date("2026-09-22T12:00:00.000Z"),
      5 * 60 * 1000,
    )).toHaveLength(1);
  });
});
