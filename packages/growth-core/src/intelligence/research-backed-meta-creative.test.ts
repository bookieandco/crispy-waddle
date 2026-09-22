import { describe, expect, it } from "vitest";
import {
  buildDirectorIntentForMetaAdConcept,
  buildMetaCreativeExperimentBlueprints,
  buildResearchBackedMetaAdPlan,
  competitorPatternsToCreativeEvidence,
} from "./research-backed-meta-creative.js";
import type { CompetitorCreativePattern } from "./competitor-ad-observation.js";

const patterns: CompetitorCreativePattern[] = [
  {
    patternId: "pattern:hook",
    kind: "hook",
    finding: "Active ads repeatedly open with a packing-friction problem.",
    observationIds: ["obs:1", "obs:2"],
    evidenceRefs: ["meta-ad-library:1", "meta-ad-library:2"],
    confidence: 0.6,
    createdAt: "2026-09-22T18:00:00.000Z",
  },
  {
    patternId: "pattern:message",
    kind: "message",
    finding: "Observed ads emphasize compression and organization.",
    observationIds: ["obs:3"],
    evidenceRefs: ["meta-ad-library:3"],
    confidence: 0.5,
    createdAt: "2026-09-22T18:00:00.000Z",
  },
];

describe("research-backed Meta creative planning", () => {
  it("treats competitor research as hypothesis evidence, not proof of performance", () => {
    const signals = competitorPatternsToCreativeEvidence({
      bigIdea: "Pack more without suitcase chaos",
      patterns,
      observedAt: "2026-09-22T18:10:00.000Z",
    });

    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.evidenceClass === "competitor_pattern")).toBe(true);
    expect(signals[0]?.sourceRefs).toContain("competitor-observation:obs:1");
  });

  it("builds original concepts with explicit product truth and differentiation", () => {
    const plan = buildResearchBackedMetaAdPlan({
      id: "plan:1",
      brandId: "brand:packnest",
      productId: "product:packnest",
      productName: "PackNest",
      productDescription: "Compression packing cubes organize clothes and compress them using a zipper.",
      productTruthRefs: ["catalog:packnest:v1"],
      patterns,
      createdAt: "2026-09-22T18:10:00.000Z",
      concepts: [{
        id: "concept:1",
        name: "Suitcase before/after",
        hook: "Your suitcase does not need more space. It needs less air.",
        message: "Organize outfits, zip the cube, then compress the volume.",
        visualDirection: "Original top-down split composition using owned product imagery; no competitor layouts.",
        format: "static_image",
        sourcePatternIds: ["pattern:hook", "pattern:message"],
        productTruthRefs: ["catalog:packnest:v1"],
        differentiation: "Use a clean compression-before/after demonstration with PackNest-specific product geometry and brand language.",
        testHypothesis: "A concrete compression demonstration will improve qualified click-through versus a generic travel-organizer message.",
      }],
    });

    expect(plan.performanceClaim).toBe("UNPROVEN_UNTIL_FIRST_PARTY_TEST");
    expect(plan.competitorCreativeReuse).toBe("FORBIDDEN_WITHOUT_RIGHTS");
    expect(plan.sourceObservationIds).toEqual(["obs:1", "obs:2", "obs:3"]);
  });

  it("produces a Director intent that forbids competitor copying and campaign launch authority", () => {
    const plan = buildResearchBackedMetaAdPlan({
      id: "plan:1",
      brandId: "brand:packnest",
      productId: "product:packnest",
      productName: "PackNest",
      productDescription: "Compression packing cubes organize clothes and compress them using a zipper.",
      productTruthRefs: ["catalog:packnest:v1"],
      patterns,
      createdAt: "2026-09-22T18:10:00.000Z",
      concepts: [{
        id: "concept:1",
        name: "Suitcase before/after",
        hook: "Your suitcase does not need more space. It needs less air.",
        message: "Organize outfits, zip the cube, then compress the volume.",
        visualDirection: "Original top-down split composition.",
        format: "static_image",
        sourcePatternIds: ["pattern:hook"],
        productTruthRefs: ["catalog:packnest:v1"],
        differentiation: "Original brand-specific compression demonstration.",
        testHypothesis: "The demonstration will improve qualified click-through.",
      }],
    });

    const intent = buildDirectorIntentForMetaAdConcept({ plan, conceptId: "concept:1" });
    expect(intent).toContain("Do not reproduce competitor");
    expect(intent).toContain("No campaign launch, spend, or publishing authority");
  });

  it("creates pairwise A/B blueprints from one control to the remaining original concepts", () => {
    const plan = buildResearchBackedMetaAdPlan({
      id: "plan:ab",
      brandId: "brand:packnest",
      productId: "product:packnest",
      productName: "PackNest",
      productDescription: "Compression packing cubes organize clothes and compress them using a zipper.",
      productTruthRefs: ["catalog:packnest:v1"],
      patterns,
      createdAt: "2026-09-22T18:10:00.000Z",
      concepts: [
        {
          id: "concept:control",
          name: "Control",
          hook: "Pack smarter.",
          message: "Organize and compress.",
          visualDirection: "Owned product on suitcase.",
          format: "static_image",
          sourcePatternIds: ["pattern:hook"],
          productTruthRefs: ["catalog:packnest:v1"],
          differentiation: "Simple owned-product control.",
          testHypothesis: "Control baseline.",
        },
        {
          id: "concept:a",
          name: "Treatment A",
          hook: "Your suitcase does not need more space. It needs less air.",
          message: "Compress clothing volume.",
          visualDirection: "Original top-down compression demo.",
          format: "static_image",
          sourcePatternIds: ["pattern:hook"],
          productTruthRefs: ["catalog:packnest:v1"],
          differentiation: "Original compression visual.",
          testHypothesis: "Compression demonstration improves qualified conversion.",
        },
        {
          id: "concept:b",
          name: "Treatment B",
          hook: "Stop unpacking your whole suitcase to find one shirt.",
          message: "Separate outfits and compress.",
          visualDirection: "Original organized outfit-cube layout.",
          format: "static_image",
          sourcePatternIds: ["pattern:message"],
          productTruthRefs: ["catalog:packnest:v1"],
          differentiation: "Organization-first creative angle.",
          testHypothesis: "Organization pain improves qualified conversion.",
        },
      ],
    });

    const blueprints = buildMetaCreativeExperimentBlueprints({
      plan,
      controlConceptId: "concept:control",
    });

    expect(blueprints).toHaveLength(2);
    expect(blueprints.every((experiment) => experiment.controlVariantId === "concept:control")).toBe(true);
    expect(blueprints.every((experiment) => experiment.requireNonNegativeIncrementalContribution)).toBe(true);
  });

  it("fails closed when a concept cites a pattern outside the research packet", () => {
    expect(() => buildResearchBackedMetaAdPlan({
      id: "plan:1",
      brandId: "brand:packnest",
      productId: "product:packnest",
      productName: "PackNest",
      productDescription: "Compression packing cubes.",
      productTruthRefs: ["catalog:packnest:v1"],
      patterns,
      createdAt: "2026-09-22T18:10:00.000Z",
      concepts: [{
        id: "concept:1",
        name: "Unknown source",
        hook: "Hook",
        message: "Message",
        visualDirection: "Original",
        format: "static_image",
        sourcePatternIds: ["pattern:not-seen"],
        productTruthRefs: ["catalog:packnest:v1"],
        differentiation: "Different",
        testHypothesis: "Test",
      }],
    })).toThrow("GROWTH_META_RESEARCH_UNKNOWN_PATTERN");
  });
});
