import { describe, expect, it } from "vitest";
import {
  assertSendableMessageEligibility,
  fingerprintSocialMessage,
} from "./messaging.js";

describe("governed social messaging contracts", () => {
  const now = new Date("2026-09-21T22:30:00Z");

  it("binds recipient, exact text, offer, voice profiles, and eligibility evidence", () => {
    const fingerprint = fingerprintSocialMessage({
      brand: "pupsonstuff",
      senderAccountId: "account-1",
      recipient: {
        recipientRef: "creator-1",
        providerRecipientId: "tt-user-1",
        provider: "tiktok",
        platform: "tiktok",
      },
      text: "Love your sleep-content angle. Open to a product collaboration?",
      offerRef: "offer-1",
      outreachPlanRef: "plan-1",
      touchId: "touch-1",
      brandVoiceProfileRef: "brand-voice:v1",
      channelVoiceProfileRef: "tiktok-voice:v1",
      eligibility: {
        state: "eligible",
        evidenceRefs: ["eligibility:creator-1"],
        observedAt: new Date().toISOString(),
      },
    });
    expect(fingerprint).toContain("creator-1");
    expect(fingerprint).toContain("offer-1");
    expect(fingerprint).toContain("tiktok-voice:v1");
  });

  it("fails closed for stale, unknown, or suppressed eligibility", () => {
    expect(() =>
      assertSendableMessageEligibility(
        { state: "eligible", evidenceRefs: ["e1"], observedAt: "2026-09-19T22:30:00Z" },
        now,
      ),
    ).toThrow(/STALE/);

    for (const state of ["unknown", "declined", "stop_contact", "suppressed"] as const) {
      expect(() =>
        assertSendableMessageEligibility(
          { state, evidenceRefs: ["e1"], observedAt: "2026-09-21T22:00:00Z" },
          now,
        ),
      ).toThrow(/ELIGIBILITY_REQUIRED/);
    }
  });

  it("changes the approval fingerprint when text or voice version changes", () => {
    const base = {
      brand: "pupsonstuff" as const,
      senderAccountId: "account-1",
      recipient: {
        recipientRef: "creator-1",
        providerRecipientId: "tt-user-1",
        provider: "tiktok",
        platform: "tiktok" as const,
      },
      text: "Open to a product collaboration?",
      brandVoiceProfileRef: "brand-voice:v1",
      channelVoiceProfileRef: "tiktok-voice:v1",
      eligibility: {
        state: "eligible" as const,
        evidenceRefs: ["e1"],
        observedAt: new Date().toISOString(),
      },
    };
    expect(fingerprintSocialMessage(base)).not.toBe(
      fingerprintSocialMessage({ ...base, text: "Open to hearing a product idea?" }),
    );
    expect(fingerprintSocialMessage(base)).not.toBe(
      fingerprintSocialMessage({ ...base, channelVoiceProfileRef: "tiktok-voice:v2" }),
    );
  });
});
