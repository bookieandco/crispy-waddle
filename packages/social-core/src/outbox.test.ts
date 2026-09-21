import { describe, expect, it } from "vitest";
import { beginOutboxAttempt, createOutboxJobs, deliverOutboxJob } from "./outbox.js";
import type { SocialPublicationProposal } from "./types.js";

const proposal: SocialPublicationProposal = {
  id: "proposal-1",
  userId: "user-1",
  actionId: "action-1",
  brand: "jhadinatv",
  text: "hello",
  mediaUrls: [],
  targets: [
    {
      accountId: "account-1",
      brand: "jhadinatv",
      provider: "hootsuite",
      providerProfileId: "profile-1",
      platform: "youtube",
    },
    {
      accountId: "account-2",
      brand: "jhadinatv",
      provider: "hootsuite",
      providerProfileId: "profile-2",
      platform: "tiktok",
    },
  ],
  status: "approved",
  requestFingerprint: "fp",
  idempotencyKey: "idem",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

describe("social outbox", () => {
  it("creates exactly one idempotent job per explicit target", () => {
    const jobs = createOutboxJobs(proposal, proposal.createdAt);
    expect(jobs).toHaveLength(2);
    expect(new Set(jobs.map((job) => job.idempotencyKey)).size).toBe(2);
    expect(jobs.map((job) => job.target.providerProfileId)).toEqual(["profile-1", "profile-2"]);
  });

  it("binds provider receipts to the exact target", () => {
    const job = beginOutboxAttempt(createOutboxJobs(proposal)[0]);
    expect(() =>
      deliverOutboxJob(job, {
        provider: "hootsuite",
        providerProfileId: "wrong-profile",
        platform: "youtube",
        providerPostId: "provider-post-1",
        state: "scheduled",
        observedAt: new Date().toISOString(),
      }),
    ).toThrow("SOCIAL_PROVIDER_RECEIPT_TARGET_MISMATCH");
  });
});
