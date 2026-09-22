import { describe, expect, it } from "vitest"
import {
  buildResearchBackedMetaAdPlan,
  createCompetitorCreativePattern,
  type CompetitorCreativePattern,
} from "@jhadina/growth-core"
import { getSocialCharacterProfileForBrand } from "@jhadina/social-core"
import { buildMetaResearchCreativeProductionJobs } from "./meta-research-creative-bridge"

function patterns(): CompetitorCreativePattern[] {
  return [
    createCompetitorCreativePattern({
      patternId: "pattern:hook",
      kind: "hook",
      finding: "Active ads often open on packing friction.",
      observationIds: ["obs:1"],
      evidenceRefs: ["meta-ad-library:obs:1"],
      confidence: 0.5,
      createdAt: "2026-09-22T18:00:00.000Z",
    }),
  ]
}

describe("Meta research creative production bridge", () => {
  it("turns each research-backed concept into a Social project and Director brief", () => {
    const plan = buildResearchBackedMetaAdPlan({
      id: "plan:1",
      brandId: "brand:packnest",
      productId: "product:packnest",
      productName: "PackNest",
      productDescription: "Compression packing cubes organize clothes and compress them using a zipper.",
      productTruthRefs: ["catalog:packnest:v1"],
      patterns: patterns(),
      createdAt: "2026-09-22T18:10:00.000Z",
      concepts: [
        {
          id: "concept:1",
          name: "Static demo",
          hook: "Your suitcase does not need more space. It needs less air.",
          message: "Organize outfits, zip the cube, then compress the volume.",
          visualDirection: "Original top-down compression demonstration.",
          format: "static_image",
          sourcePatternIds: ["pattern:hook"],
          productTruthRefs: ["catalog:packnest:v1"],
          differentiation: "Owned-product geometry and an original split composition.",
          testHypothesis: "Concrete compression demonstration improves qualified conversion.",
        },
        {
          id: "concept:2",
          name: "Video demo",
          hook: "Watch this cube shrink your packing volume.",
          message: "Pack, zip, compress.",
          visualDirection: "Original short product demonstration using owned product assets.",
          format: "video",
          sourcePatternIds: ["pattern:hook"],
          productTruthRefs: ["catalog:packnest:v1"],
          differentiation: "Original motion sequence and brand-specific product details.",
          testHypothesis: "Motion demonstration improves qualified conversion.",
        },
      ],
    })

    const jobs = buildMetaResearchCreativeProductionJobs({
      plan,
      production: {
        brand: "jhadina",
        authorityPositionRef: "authority:packnest",
        pillarRef: "pillar:travel-efficiency",
        brandPointOfViewRef: "brand-pov:packnest:v1",
        brandPointOfView: "Travel gear should remove packing friction without inventing extra complexity.",
        brandPointOfViewEvidenceRefs: ["brand-strategy:packnest:v1"],
        character: getSocialCharacterProfileForBrand("jhadina"),
        directorProjectId: "director:packnest",
        platform: "instagram",
        productIdentityRef: "product-bible:packnest:v1",
        styleIdentityRef: "style-bible:packnest:clean-demo:v1",
        platformCreativeProfileRef: "profile:instagram-feed:2026-09",
        fixedDimensionRefs: {
          audience: "audience:travelers",
          offer: "offer:packnest:base",
          landingMessage: "landing:packnest:v1",
        },
        createdAt: "2026-09-22T18:20:00.000Z",
      },
    })

    expect(jobs).toHaveLength(2)
    expect(jobs[0]?.contentProject.primaryJob).toBe("conversion")
    expect(jobs[0]?.directorBrief.mediaType).toBe("image")
    expect(jobs[1]?.directorBrief.mediaType).toBe("video")
    expect(jobs.every((job) => job.campaignAuthority === "NONE")).toBe(true)
    expect(jobs[0]?.directorBrief.intent).toContain("Do not reproduce competitor")
    expect(jobs[0]?.contentProject.characterProfileRef).toBe("character:jhadina")
    expect(jobs[0]?.directorBrief.intent).toContain("Brand voice profile: brand-voice:jhadina")
    expect(jobs[0]?.directorBrief.creativeIdentity).toMatchObject({
      productIdentityRef: "product-bible:packnest:v1",
      styleIdentityRef: "style-bible:packnest:clean-demo:v1",
      platformCreativeProfileRef: "profile:instagram-feed:2026-09",
      experimentVariantId: "meta-creative:plan:1:concept:1",
      mutationAxis: "net_new_concept",
    })
    expect(jobs[0]?.directorBrief.creativeIdentity?.fixedDimensionRefs).toEqual({
      audience: "audience:travelers",
      offer: "offer:packnest:base",
      landingMessage: "landing:packnest:v1",
    })
  })

  it("requires product and style identity to be supplied together", () => {
    const plan = buildResearchBackedMetaAdPlan({
      id: "plan:identity",
      brandId: "brand:packnest",
      productId: "product:packnest",
      productName: "PackNest",
      productDescription: "Compression packing cubes.",
      productTruthRefs: ["catalog:packnest:v1"],
      patterns: patterns(),
      createdAt: "2026-09-22T18:10:00.000Z",
      concepts: [{
        id: "concept:identity",
        name: "Static demo",
        hook: "Compress more.",
        message: "Zip and compress.",
        visualDirection: "Original product demo.",
        format: "static_image",
        sourcePatternIds: ["pattern:hook"],
        productTruthRefs: ["catalog:packnest:v1"],
        differentiation: "Original.",
        testHypothesis: "Test.",
      }],
    })

    expect(() => buildMetaResearchCreativeProductionJobs({
      plan,
      production: {
        brand: "jhadina",
        authorityPositionRef: "authority:packnest",
        pillarRef: "pillar:travel",
        brandPointOfViewRef: "brand-pov:packnest:v1",
        brandPointOfView: "Remove packing friction.",
        brandPointOfViewEvidenceRefs: ["brand-strategy:packnest:v1"],
        character: getSocialCharacterProfileForBrand("jhadina"),
        directorProjectId: "director:packnest",
        platform: "instagram",
        productIdentityRef: "product-bible:packnest:v1",
      },
    })).toThrow("META_CREATIVE_PRODUCT_STYLE_IDENTITY_PAIR_REQUIRED")
  })

  it("rejects a Social character from a different brand", () => {
    const plan = buildResearchBackedMetaAdPlan({
      id: "plan:mismatch",
      brandId: "brand:packnest",
      productId: "product:packnest",
      productName: "PackNest",
      productDescription: "Compression packing cubes.",
      productTruthRefs: ["catalog:packnest:v1"],
      patterns: patterns(),
      createdAt: "2026-09-22T18:10:00.000Z",
      concepts: [{
        id: "concept:1",
        name: "Static demo",
        hook: "Compress more.",
        message: "Zip and compress.",
        visualDirection: "Original product demo.",
        format: "static_image",
        sourcePatternIds: ["pattern:hook"],
        productTruthRefs: ["catalog:packnest:v1"],
        differentiation: "Original.",
        testHypothesis: "Test.",
      }],
    })

    expect(() => buildMetaResearchCreativeProductionJobs({
      plan,
      production: {
        brand: "pupsonstuff",
        authorityPositionRef: "authority:pups",
        pillarRef: "pillar:pet",
        brandPointOfViewRef: "brand-pov:pups:v1",
        brandPointOfView: "Make pet products delightful.",
        brandPointOfViewEvidenceRefs: ["brand-strategy:pups:v1"],
        character: getSocialCharacterProfileForBrand("atwood-bookie"),
        directorProjectId: "director:pups",
        platform: "instagram",
      },
    })).toThrow("META_CREATIVE_CHARACTER_BRAND_MISMATCH")
  })

  it("requires a brand POV before research can become produced advertising", () => {
    const plan = buildResearchBackedMetaAdPlan({
      id: "plan:1",
      brandId: "brand:packnest",
      productId: "product:packnest",
      productName: "PackNest",
      productDescription: "Compression packing cubes.",
      productTruthRefs: ["catalog:packnest:v1"],
      patterns: patterns(),
      createdAt: "2026-09-22T18:10:00.000Z",
      concepts: [{
        id: "concept:1",
        name: "Static demo",
        hook: "Compress more.",
        message: "Zip and compress.",
        visualDirection: "Original product demo.",
        format: "static_image",
        sourcePatternIds: ["pattern:hook"],
        productTruthRefs: ["catalog:packnest:v1"],
        differentiation: "Original.",
        testHypothesis: "Test.",
      }],
    })

    expect(() => buildMetaResearchCreativeProductionJobs({
      plan,
      production: {
        brand: "jhadina",
        authorityPositionRef: "authority:packnest",
        pillarRef: "pillar:travel",
        brandPointOfViewRef: "",
        brandPointOfView: "",
        brandPointOfViewEvidenceRefs: [],
        directorProjectId: "director:packnest",
        platform: "facebook",
      },
    })).toThrow("META_CREATIVE_BRAND_POV_REQUIRED")
  })
})
