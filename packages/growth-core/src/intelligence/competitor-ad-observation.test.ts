import { describe, expect, it } from "vitest";
import {
  assertCompetitorAdObservation,
  competitorAdObservationKey,
  createCompetitorCreativePattern,
  type CompetitorAdObservation,
} from "./competitor-ad-observation.js";

function observed(): CompetitorAdObservation {
  return {
    observationId: "competitor-ad:meta:123:2026-09-21T12:00:00.000Z",
    provider: "meta-ad-library",
    source: "meta_ad_library_ui",
    sourceRecordId: "123",
    advertiserName: "Example Brand",
    status: "active",
    platforms: ["facebook", "instagram"],
    country: "US",
    startedAt: "2026-09-01T00:00:00Z",
    body: "Observed ad copy",
    headline: "Observed headline",
    callToAction: "Shop Now",
    landingUrl: "https://example.com/product",
    landingDomain: "example.com",
    creativeRefs: [
      { kind: "snapshot", locator: "https://www.facebook.com/ads/library/?id=123" },
    ],
    observedAt: "2026-09-21T12:00:00Z",
    sourceLocator: "https://www.facebook.com/ads/library/?id=123",
    sourceEvidenceRefs: ["evidence:meta-ad-library:123"],
  };
}

describe("competitor ad observations", () => {
  it("accepts source-observed commercial creative facts without invented metrics", () => {
    const observation = observed();
    expect(() => assertCompetitorAdObservation(observation)).not.toThrow();
    expect(observation.spend).toBeUndefined();
    expect(observation.impressions).toBeUndefined();
  });

  it("accepts ranges when the source actually provides them", () => {
    const observation = {
      ...observed(),
      source: "meta_ad_library_api" as const,
      impressions: { lowerBound: 1000, upperBound: 5000 },
      spend: { lowerBound: 100, upperBound: 499, currency: "USD" },
    };
    expect(() => assertCompetitorAdObservation(observation)).not.toThrow();
  });

  it("rejects malformed spend ranges and missing evidence", () => {
    expect(() =>
      assertCompetitorAdObservation({
        ...observed(),
        spend: { lowerBound: 500, upperBound: 100, currency: "USD" },
      }),
    ).toThrow(/SPEND_RANGE/);

    expect(() =>
      assertCompetitorAdObservation({
        ...observed(),
        sourceEvidenceRefs: [],
      }),
    ).toThrow(/EVIDENCE_REQUIRED/);
  });

  it("builds a deterministic observation key from source identity and time", () => {
    expect(
      competitorAdObservationKey({
        source: "meta_ad_library_ui",
        sourceRecordId: "123",
        observedAt: "2026-09-21T12:00:00Z",
      }),
    ).toBe("competitor-ad:meta_ad_library_ui:123:2026-09-21T12:00:00.000Z");
  });

  it("keeps inferred creative patterns separate from observed facts", () => {
    const pattern = createCompetitorCreativePattern({
      patternId: "pattern:problem-first",
      kind: "hook",
      finding: "Multiple observed ads lead with the problem before the offer.",
      observationIds: ["ad-1", "ad-2"],
      evidenceRefs: ["evidence-1", "evidence-2"],
      confidence: 0.75,
      createdAt: "2026-09-21T13:00:00Z",
    });

    expect(pattern.finding).toMatch(/problem/);
    expect(pattern.observationIds).toEqual(["ad-1", "ad-2"]);
    expect(Object.isFrozen(pattern.observationIds)).toBe(true);
  });
});
