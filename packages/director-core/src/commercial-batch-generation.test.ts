import { describe, expect, it } from "vitest";
import {
  planCommercialBatchChunks,
  type CommercialBatchGenerationPlan,
} from "./commercial-batch-generation.js";

function plan(): CommercialBatchGenerationPlan {
  return {
    id: "batch:fall-clothing:1",
    projectId: "affiliate:tiktok",
    platform: "tiktok",
    items: ["sweater", "jacket", "dress"].map((product) => ({
      id: `item:${product}`,
      productRef: `product:${product}`,
      productTruthLockRef: `truth:${product}:v1`,
      productReferenceAssetIds: [`asset:${product}`],
      rightsEvidenceIds: [`rights:${product}`],
      variationNotes: ["change pose", "preserve exact product"],
    })),
    referencePattern: {
      id: "pattern:mirror-product-showcase",
      sourceRef: "reference:observed-video",
      evidenceIds: ["evidence:reference-video"],
      hookClass: "seasonal-product-showcase",
      framing: ["vertical mirror-style framing"],
      motionLanguage: ["slow garment movement", "detail reveal"],
      pacingNotes: ["short", "product-first"],
      productDemonstrationPattern: ["front", "material detail", "alternate angle"],
    },
    characterRef: "character:affiliate:1",
    characterRightsEvidenceIds: ["rights:synthetic-character"],
    durationSeconds: 6,
    aspectRatio: "9:16",
    audioMode: "silent",
    providerCandidateIds: ["provider:niche", "provider:runpod"],
    maxItemsPerProviderBatch: 2,
    estimatedCreditsPerItem: 72,
    maxEstimatedCredits: 216,
    publicationAuthority: "NO_PUBLISH_AUTHORITY",
  };
}

describe("commercial batch generation", () => {
  it("chunks product variants to provider capacity and keeps publication separate", () => {
    const chunks = planCommercialBatchChunks(plan());
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.itemIds).toEqual(["item:sweater", "item:jacket"]);
    expect(chunks[0]?.estimatedCredits).toBe(144);
    expect(chunks[1]?.estimatedCredits).toBe(72);
  });

  it("fails before generation when estimated batch spend exceeds the approved ceiling", () => {
    const over = { ...plan(), maxEstimatedCredits: 100 };
    expect(() => planCommercialBatchChunks(over)).toThrow(/CREDIT_BUDGET_EXCEEDED/);
  });
});
