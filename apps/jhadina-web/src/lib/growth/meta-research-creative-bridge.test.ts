import { describe, expect, it } from "vitest"
import {
  buildResearchBackedMetaAdPlan,
  createCompetitorCreativePattern,
  type CompetitorCreativePattern,
} from "@jhadina/growth-core"
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
        directorProjectId: "director:packnest",
        platform: "instagram",
        createdAt: "2026-09-22T18:20:00.000Z",
      },
    })

    expect(jobs).toHaveLength(2)
    expect(jobs[0]?.contentProject.primaryJob).toBe("conversion")
    expect(jobs[0]?.directorBrief.mediaType).toBe("image")
    expect(jobs[1]?.directorBrief.mediaType).toBe("video")
    expect(jobs.every((job) => job.campaignAuthority === "NONE")).toBe(true)
    expect(jobs[0]?.directorBrief.intent).toContain("Do not reproduce competitor")
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
