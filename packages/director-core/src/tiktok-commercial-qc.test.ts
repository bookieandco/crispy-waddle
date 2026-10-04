import { describe, expect, it } from "vitest";
import { evaluateTikTokCommercialQc } from "./tiktok-commercial-qc.js";

const truthLock = {
  id: "truth:product-1:v1",
  productId: "product-1",
  version: 1,
  assertions: [{
    field: "color" as const,
    key: "primary_color",
    value: "blue",
    sourceRef: "tiktok:pdp:product-1",
    evidenceIds: ["evidence:pdp"],
  }],
  referenceAssetIds: ["asset:product-1"],
  evidenceIds: ["evidence:pdp"],
  lockedAt: "2026-10-04T09:00:00Z",
  authority: "DIRECTOR_PRODUCT_TRUTH_LOCK" as const,
};

describe("TikTok commercial QC", () => {
  it("passes only when truth, offers, rights and disclosures are current", () => {
    const result = evaluateTikTokCommercialQc({
      id: "qc:1",
      productRef: "product-1",
      truthLock,
      representations: [{
        field: "color",
        key: "primary_color",
        value: "blue",
      }],
      claims: [{
        claimRef: "claim:color",
        text: "Blue finish",
        productRef: "product-1",
        evidenceIds: ["evidence:pdp"],
      }],
      offers: [{
        offerRef: "offer:1",
        productRef: "product-1",
        state: "active",
        validUntil: "2026-10-05T09:00:00Z",
        evidenceIds: ["evidence:offer"],
      }],
      referencedOfferRefs: ["offer:1"],
      rightsEvidenceIds: ["rights:product-media"],
      sourceEvidenceIds: ["evidence:pdp"],
      aiEdited: true,
      aiDisclosurePresent: true,
      syntheticPersonDepicted: false,
      syntheticPersonDisclosurePresent: false,
      commercialDisclosurePresent: true,
      evaluatedAt: "2026-10-04T09:30:00Z",
    });
    expect(result.status).toBe("pass");
    expect(result.publicationAuthorized).toBe(false);
    expect(result.approvedOfferRefs).toEqual(["offer:1"]);
  });

  it("blocks invented product facts and stale offers", () => {
    const result = evaluateTikTokCommercialQc({
      id: "qc:2",
      productRef: "product-1",
      truthLock,
      representations: [{
        field: "color",
        key: "primary_color",
        value: "red",
      }],
      claims: [],
      offers: [{
        offerRef: "offer:expired",
        productRef: "product-1",
        state: "active",
        validUntil: "2026-10-03T09:00:00Z",
        evidenceIds: ["evidence:offer"],
      }],
      referencedOfferRefs: ["offer:expired"],
      rightsEvidenceIds: ["rights:product-media"],
      sourceEvidenceIds: ["evidence:pdp"],
      aiEdited: true,
      aiDisclosurePresent: false,
      syntheticPersonDepicted: true,
      syntheticPersonDisclosurePresent: false,
      commercialDisclosurePresent: false,
      evaluatedAt: "2026-10-04T09:30:00Z",
    });
    expect(result.status).toBe("blocked");
    expect(result.reasons.join("|")).toMatch(/MISMATCH/);
    expect(result.reasons.join("|")).toMatch(/OFFER_EXPIRED/);
    expect(result.reasons.join("|")).toMatch(/AI_DISCLOSURE_REQUIRED/);
  });
});
