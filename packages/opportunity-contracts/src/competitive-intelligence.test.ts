import { describe, expect, it } from "vitest";
import {
  isAuthoritativeCompetitiveEvidence,
  type CompetitiveEvidence,
} from "./competitive-intelligence";

describe("competitive intelligence evidence", () => {
  it("treats sourced observations as authoritative evidence", () => {
    const evidence: CompetitiveEvidence = {
      evidenceId: "ev-1",
      kind: "observed_fact",
      subjectId: "product-1",
      value: { priceMinor: 1999, currency: "USD" },
      source: {
        sourceId: "etsy-listing-1",
        sourceType: "marketplace",
        locator: "https://example.test/listing/1",
        observedAt: "2026-08-30T12:00:00.000Z",
      },
      createdAt: "2026-08-30T12:00:00.000Z",
    };

    expect(isAuthoritativeCompetitiveEvidence(evidence)).toBe(true);
  });

  it("does not treat inferred signals as observed facts", () => {
    const evidence: CompetitiveEvidence = {
      evidenceId: "signal-1",
      kind: "inferred_signal",
      subjectId: "product-1",
      value: { priceTrend: "up" },
      derivedFromEvidenceIds: ["ev-1"],
      confidence: 0.9,
      createdAt: "2026-08-30T12:01:00.000Z",
    };

    expect(isAuthoritativeCompetitiveEvidence(evidence)).toBe(false);
  });

  it("keeps predictions and recommendations distinct from source evidence", () => {
    const prediction: CompetitiveEvidence = {
      evidenceId: "prediction-1",
      kind: "model_prediction",
      subjectId: "product-1",
      value: { demandScore: 0.82 },
      derivedFromEvidenceIds: ["ev-1", "signal-1"],
      modelId: "demand-model-v1",
      confidence: 0.82,
      createdAt: "2026-08-30T12:02:00.000Z",
    };
    const recommendation: CompetitiveEvidence = {
      evidenceId: "recommendation-1",
      kind: "recommended_action",
      subjectId: "product-1",
      value: { action: "review-price" },
      derivedFromEvidenceIds: ["prediction-1"],
      modelId: "pricing-policy-v1",
      createdAt: "2026-08-30T12:03:00.000Z",
    };

    expect(prediction.kind).not.toBe(recommendation.kind);
    expect(isAuthoritativeCompetitiveEvidence(prediction)).toBe(false);
    expect(isAuthoritativeCompetitiveEvidence(recommendation)).toBe(false);
  });
});
