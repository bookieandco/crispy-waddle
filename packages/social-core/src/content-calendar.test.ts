import { describe, expect, it } from "vitest";
import { assertSocialCalendarBatchCurrent, buildSocialCalendarBatch } from "./content-calendar.js";
import type { SocialPublicationProposal } from "./types.js";

function proposal(id: string, scheduledAt: string): SocialPublicationProposal {
  return {
    id,
    userId: "user-1",
    actionId: `action-${id}`,
    brand: "jhadina",
    text: `Post ${id}`,
    mediaUrls: [],
    scheduledAt,
    targets: [{
      accountId: "acct-1",
      brand: "jhadina",
      provider: "hootsuite",
      providerProfileId: "profile-1",
      platform: "linkedin",
    }],
    status: "pending_approval",
    requestFingerprint: `fingerprint-${id}`,
    idempotencyKey: `idem-${id}`,
    approvalReceiptId: `receipt-${id}`,
    createdAt: "2026-09-22T12:00:00.000Z",
    updatedAt: "2026-09-22T12:00:00.000Z",
  };
}

describe("social content calendar batches", () => {
  it("builds a stable chronological batch from exact pending proposals", () => {
    const batch = buildSocialCalendarBatch("batch-1", [
      proposal("later", "2026-09-24T12:00:00.000Z"),
      proposal("earlier", "2026-09-23T12:00:00.000Z"),
    ], new Date("2026-09-22T12:00:00.000Z"));

    expect(batch.entries.map((entry) => entry.proposalId)).toEqual(["earlier", "later"]);
    expect(batch.fingerprint).toContain("fingerprint-earlier");
  });

  it("rejects non-exact or already-approved proposals from preflight", () => {
    expect(() => buildSocialCalendarBatch(
      "batch-1",
      [{ ...proposal("x", "2026-09-23T12:00:00.000Z"), status: "approved" }],
      new Date("2026-09-22T12:00:00.000Z"),
    )).toThrow("SOCIAL_CALENDAR_PROPOSAL_NOT_PENDING");

    expect(() => buildSocialCalendarBatch(
      "batch-1",
      [{ ...proposal("x", "2026-09-23T12:00:00.000Z"), targets: [] }],
      new Date("2026-09-22T12:00:00.000Z"),
    )).toThrow("SOCIAL_CALENDAR_EXACT_TARGET_REQUIRED");
  });

  it("detects any mutation after review", () => {
    const current = [
      proposal("a", "2026-09-23T12:00:00.000Z"),
      proposal("b", "2026-09-24T12:00:00.000Z"),
    ];
    const batch = buildSocialCalendarBatch(
      "batch-1",
      current,
      new Date("2026-09-22T12:00:00.000Z"),
    );

    expect(() => assertSocialCalendarBatchCurrent(batch, [
      current[0],
      { ...current[1], requestFingerprint: "changed" },
    ])).toThrow("SOCIAL_CALENDAR_BATCH_MUTATED");
  });
});
