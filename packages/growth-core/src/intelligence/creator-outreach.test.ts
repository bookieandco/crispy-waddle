import { describe, expect, it } from "vitest";
import {
  prepareOutreachTouchProposal,
  type OutreachPlan,
  type OutreachTouchDraft,
} from "./creator-outreach.js";

const plan: OutreachPlan = {
  planId: "outreach:campaign-1:creator-1",
  campaignId: "campaign-1",
  creatorRef: "creator-1",
  brandId: "brand-1",
  channel: "tiktok",
  offerRef: "offer-1",
  brandVoiceProfileRef: "voice:brand:v1",
  channelVoiceProfileRef: "voice:tiktok:v1",
  messageDraftRefs: ["draft-1", "draft-2"],
  eligibility: "eligible",
  eligibilityEvidenceRefs: ["eligibility:creator-1:2026-09-21"],
  maxTouches: 4,
  stopState: "active",
  createdAt: "2026-09-21T12:00:00Z",
  expiresAt: "2026-10-21T12:00:00Z",
};

const firstTouch: OutreachTouchDraft = {
  touchId: "touch-1",
  planId: plan.planId,
  ordinal: 1,
  message: "Loved your recent sleep setup video. We have a product collaboration idea if you're open to hearing it.",
  valueAdd: "Specific campaign fit and approved product offer.",
  status: "draft",
};

describe("creator outreach planning", () => {
  it("prepares exactly one eligible current touch for later governed approval", () => {
    const proposal = prepareOutreachTouchProposal({
      plan,
      draft: firstTouch,
      dueAt: "2026-09-22T12:00:00Z",
    });

    expect(proposal.creatorRef).toBe("creator-1");
    expect(proposal.channel).toBe("tiktok");
    expect(proposal.exactMessageFingerprint).toContain(firstTouch.message);
    expect(Object.isFrozen(proposal)).toBe(true);
  });

  it("fails closed for unknown eligibility", () => {
    expect(() =>
      prepareOutreachTouchProposal({
        plan: { ...plan, eligibility: "unknown" },
        draft: firstTouch,
        dueAt: "2026-09-22T12:00:00Z",
      }),
    ).toThrow(/ELIGIBILITY_REQUIRED/);
  });

  it("honors decline and suppression stop states", () => {
    for (const stopState of ["declined", "stop_contact", "suppressed"] as const) {
      expect(() =>
        prepareOutreachTouchProposal({
          plan: { ...plan, stopState },
          draft: firstTouch,
          dueAt: "2026-09-22T12:00:00Z",
        }),
      ).toThrow(/PLAN_STOPPED/);
    }
  });

  it("rejects touches beyond the bounded cadence", () => {
    expect(() =>
      prepareOutreachTouchProposal({
        plan,
        draft: { ...firstTouch, touchId: "touch-5", ordinal: 5 },
        dueAt: "2026-09-22T12:00:00Z",
      }),
    ).toThrow(/TOUCH_LIMIT_EXCEEDED/);
  });

  it("binds the fingerprint to message and voice versions", () => {
    const a = prepareOutreachTouchProposal({
      plan,
      draft: firstTouch,
      dueAt: "2026-09-22T12:00:00Z",
    });
    const b = prepareOutreachTouchProposal({
      plan: { ...plan, channelVoiceProfileRef: "voice:tiktok:v2" },
      draft: firstTouch,
      dueAt: "2026-09-22T12:00:00Z",
    });
    expect(a.exactMessageFingerprint).not.toBe(b.exactMessageFingerprint);
  });
});
