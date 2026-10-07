import { describe, expect, it } from "vitest";
import { getSocialCharacterProfileForBrand } from "./character-profiles.js";
import { compileProfileCommentBrief } from "./community-engagement.js";

describe("profile-voice community engagement", () => {
  it("builds a relevant profile-bound brief without granting send authority", () => {
    const profile = getSocialCharacterProfileForBrand("pupsonstuff");
    expect(profile).toBeDefined();

    const brief = compileProfileCommentBrief({
      id: "comment-brief:pupson:1",
      profile: profile!,
      opportunity: {
        id: "opportunity:pet-topic:1",
        brand: "pupsonstuff",
        platform: "instagram",
        targetContentRef: "instagram:post:pet-topic",
        targetCreatorRef: "creator:pet-account",
        topic: "funny pet behavior",
        publicContextSummary: "A public pet account posted a lighthearted pet-behavior clip.",
        brandFit: 95,
        audienceOverlap: 93,
        freshness: 90,
        humorFit: 92,
        commercialRelevance: 75,
        evidenceRefs: ["radar:pet-topic"],
        observedAt: "2026-10-07T18:00:00.000Z",
      },
    });

    expect(brief.characterProfileRef).toBe("character:pupsonstuff");
    expect(brief.humorAllowed).toBe(true);
    expect(brief.promotionalLinkAllowed).toBe(false);
    expect(brief.requiresWeeklyApproval).toBe(true);
    expect(brief.policy.massEngagementAllowed).toBe(false);
    expect(brief.policy.unsolicitedDirectMessageAuthority).toBe("NONE");
  });

  it("rejects weakly related conversations", () => {
    const profile = getSocialCharacterProfileForBrand("truckeros");
    expect(profile).toBeDefined();

    expect(() => compileProfileCommentBrief({
      id: "comment-brief:truckeros:weak",
      profile: profile!,
      opportunity: {
        id: "opportunity:unrelated",
        brand: "truckeros",
        platform: "facebook",
        targetContentRef: "facebook:post:unrelated",
        topic: "unrelated lifestyle topic",
        publicContextSummary: "A public post with no meaningful trucking relevance.",
        brandFit: 20,
        audienceOverlap: 15,
        freshness: 90,
        humorFit: 70,
        commercialRelevance: 5,
        evidenceRefs: ["radar:unrelated"],
        observedAt: "2026-10-07T18:00:00.000Z",
      },
    })).toThrow(/RELEVANCE_TOO_LOW/);
  });

  it("does not let one brand speak through another brand profile", () => {
    const profile = getSocialCharacterProfileForBrand("atwood-bookie");
    expect(profile).toBeDefined();

    expect(() => compileProfileCommentBrief({
      id: "comment-brief:brand-mismatch",
      profile: profile!,
      opportunity: {
        id: "opportunity:truck-topic",
        brand: "truckeros",
        platform: "facebook",
        targetContentRef: "facebook:post:truck-topic",
        topic: "owner operator costs",
        publicContextSummary: "A trucking discussion about operating costs.",
        brandFit: 95,
        audienceOverlap: 90,
        freshness: 90,
        humorFit: 60,
        commercialRelevance: 80,
        evidenceRefs: ["radar:truck-topic"],
        observedAt: "2026-10-07T18:00:00.000Z",
      },
    })).toThrow(/PROFILE_BRAND_MISMATCH/);
  });
});
