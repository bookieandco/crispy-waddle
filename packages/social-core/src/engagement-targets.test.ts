import { describe, expect, it } from "vitest";
import {
  createCuratedEngagementTarget,
  createDiscoveredEngagementTarget,
  engagementOpportunityFromTargetObservation,
  rankEngagementTargets,
} from "./engagement-targets.js";
import { getSocialCharacterProfileForBrand } from "./character-profiles.js";
import { compileProfileCommentBrief } from "./community-engagement.js";

describe("engagement target registry", () => {
  it("prioritizes an owner-curated account over a comparable discovered account", () => {
    const curated = createCuratedEngagementTarget({
      id: "target:owner:1",
      brand: "pupsonstuff",
      platform: "instagram",
      accountRef: "instagram:account:owner-choice",
      handleOrLabel: "Owner Choice",
      topicTags: ["dogs", "pet humor"],
      campaignRefs: ["campaign:pupson:week"],
      evidenceRefs: ["owner:curated:1"],
      addedAt: "2026-10-07T18:00:00.000Z",
    });
    const discovered = createDiscoveredEngagementTarget({
      id: "target:discovered:1",
      brand: "pupsonstuff",
      platform: "instagram",
      accountRef: "instagram:account:discovered",
      handleOrLabel: "Discovered Account",
      priority: 90,
      topicTags: ["dogs", "pet humor"],
      campaignRefs: ["campaign:pupson:week"],
      evidenceRefs: ["radar:discovered:1"],
      addedAt: "2026-10-07T18:00:00.000Z",
    });

    const ranked = rankEngagementTargets({
      targets: [discovered, curated],
      brand: "pupsonstuff",
      campaignRef: "campaign:pupson:week",
      topicTags: ["dogs", "pet humor"],
    });

    expect(ranked[0]?.target.id).toBe(curated.id);
    expect(ranked[0]?.target.source).toBe("owner_curated");
    expect(curated.policy.observeWithoutApproval).toBe(true);
    expect(curated.policy.publicCommentRequiresWeeklyApproval).toBe(true);
  });

  it("lets one curated account be scoped to a specific campaign", () => {
    const target = createCuratedEngagementTarget({
      id: "target:truck:1",
      brand: "truckeros",
      platform: "facebook",
      accountRef: "facebook:page:industry",
      handleOrLabel: "Industry Page",
      campaignRefs: ["campaign:truckeros:owner-operators"],
      topicTags: ["owner operators", "freight"],
      evidenceRefs: ["owner:curated:truck"],
      addedAt: "2026-10-07T18:00:00.000Z",
    });

    expect(rankEngagementTargets({
      targets: [target],
      brand: "truckeros",
      campaignRef: "campaign:truckeros:owner-operators",
      topicTags: ["freight"],
    })).toHaveLength(1);

    expect(rankEngagementTargets({
      targets: [target],
      brand: "truckeros",
      campaignRef: "campaign:truckeros:other",
      topicTags: ["freight"],
    })).toHaveLength(0);
  });

  it("converts a fresh public post from a curated target into the normal relevance pipeline", () => {
    const target = createCuratedEngagementTarget({
      id: "target:pup:creator",
      brand: "pupsonstuff",
      platform: "instagram",
      accountRef: "instagram:creator:pet",
      handleOrLabel: "Pet Creator",
      topicTags: ["dogs"],
      evidenceRefs: ["owner:curated:pet"],
      addedAt: "2026-10-07T18:00:00.000Z",
    });

    const opportunity = engagementOpportunityFromTargetObservation({
      target,
      observation: {
        id: "observation:pet:1",
        targetAccountId: target.id,
        targetContentRef: "instagram:post:pet:1",
        topic: "dog behavior",
        publicContextSummary: "A public post about humorous dog behavior.",
        observedAt: "2026-10-07T18:30:00.000Z",
        brandFit: 94,
        audienceOverlap: 92,
        freshness: 95,
        humorFit: 88,
        commercialRelevance: 76,
        evidenceRefs: ["provider:public-post:pet:1"],
      },
    });

    const profile = getSocialCharacterProfileForBrand("pupsonstuff");
    expect(profile).toBeDefined();
    const brief = compileProfileCommentBrief({
      id: "comment-brief:curated:1",
      profile: profile!,
      opportunity,
    });

    expect(brief.targetContentRef).toBe("instagram:post:pet:1");
    expect(brief.requiresWeeklyApproval).toBe(true);
    expect(brief.evidenceRefs).toContain(
      "engagement-target-source:owner_curated",
    );
  });

  it("does not let a pinned account bypass post-level relevance", () => {
    const target = createCuratedEngagementTarget({
      id: "target:pup:unrelated-posts",
      brand: "pupsonstuff",
      platform: "instagram",
      accountRef: "instagram:creator:broad",
      handleOrLabel: "Broad Creator",
      priority: 100,
      evidenceRefs: ["owner:curated:broad"],
      addedAt: "2026-10-07T18:00:00.000Z",
    });

    const opportunity = engagementOpportunityFromTargetObservation({
      target,
      observation: {
        id: "observation:unrelated",
        targetAccountId: target.id,
        targetContentRef: "instagram:post:unrelated",
        topic: "unrelated topic",
        publicContextSummary: "A public post that is not relevant to the brand.",
        observedAt: "2026-10-07T18:30:00.000Z",
        brandFit: 15,
        audienceOverlap: 10,
        freshness: 95,
        humorFit: 80,
        commercialRelevance: 5,
        evidenceRefs: ["provider:public-post:unrelated"],
      },
    });

    const profile = getSocialCharacterProfileForBrand("pupsonstuff");
    expect(profile).toBeDefined();
    expect(() => compileProfileCommentBrief({
      id: "comment-brief:curated:unrelated",
      profile: profile!,
      opportunity,
    })).toThrow(/RELEVANCE_TOO_LOW/);
  });
});
