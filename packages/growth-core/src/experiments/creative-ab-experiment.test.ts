import { describe, expect, it } from "vitest";
import {
  assessBinaryCreativeExperiment,
  buildCreativeExperimentFeatureRows,
  type BinaryCreativeExperiment,
} from "./creative-ab-experiment.js";

const experiment: BinaryCreativeExperiment = {
  id: "experiment:creative-1",
  controlVariantId: "creative:control",
  treatmentVariantId: "creative:treatment",
  hypothesis: "Treatment improves conversion rate without weakening contribution economics.",
  minimumExposuresPerVariant: 1000,
  minimumConversionsPerVariant: 20,
  alpha: 0.05,
  minimumRelativeLift: 0.1,
  requireNonNegativeIncrementalContribution: true,
};

describe("creative A/B experiment evaluator", () => {
  it("refuses to declare a result before minimum evidence exists", () => {
    const result = assessBinaryCreativeExperiment({
      experiment,
      observations: [
        {
          variantId: "creative:control",
          exposures: 300,
          conversions: 15,
          spend: 100,
          contributionMargin: 250,
          observedAt: "2026-09-22T18:00:00.000Z",
          evidenceRefs: ["meta:control"],
        },
        {
          variantId: "creative:treatment",
          exposures: 300,
          conversions: 21,
          spend: 100,
          contributionMargin: 280,
          observedAt: "2026-09-22T18:00:00.000Z",
          evidenceRefs: ["meta:treatment"],
        },
      ],
    });

    expect(result.status).toBe("insufficient_evidence");
    expect(result.decision).toBe("keep_collecting");
    expect(result.authority).toBe("LEARNING_ONLY");
  });

  it("supports treatment only when lift is significant, practical, and economically acceptable", () => {
    const result = assessBinaryCreativeExperiment({
      experiment,
      observations: [
        {
          variantId: "creative:control",
          exposures: 5000,
          conversions: 250,
          spend: 1500,
          contributionMargin: 4000,
          observedAt: "2026-09-22T18:00:00.000Z",
          evidenceRefs: ["meta:control"],
        },
        {
          variantId: "creative:treatment",
          exposures: 5000,
          conversions: 340,
          spend: 1550,
          contributionMargin: 4700,
          observedAt: "2026-09-22T18:00:00.000Z",
          evidenceRefs: ["meta:treatment"],
        },
      ],
    });

    expect(result.status).toBe("statistically_supported");
    expect(result.decision).toBe("promote_treatment_for_next_test");
    expect(result.relativeLift).toBeGreaterThan(0.1);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.incrementalContributionPerExposure).toBeGreaterThan(0);
  });

  it("blocks scaling when conversion lift is supported but contribution economics are weaker", () => {
    const result = assessBinaryCreativeExperiment({
      experiment,
      observations: [
        {
          variantId: "creative:control",
          exposures: 5000,
          conversions: 250,
          spend: 1200,
          contributionMargin: 5000,
          observedAt: "2026-09-22T18:00:00.000Z",
          evidenceRefs: ["meta:control"],
        },
        {
          variantId: "creative:treatment",
          exposures: 5000,
          conversions: 340,
          spend: 2500,
          contributionMargin: 3900,
          observedAt: "2026-09-22T18:00:00.000Z",
          evidenceRefs: ["meta:treatment"],
        },
      ],
    });

    expect(result.status).toBe("statistically_supported_but_economically_weak");
    expect(result.decision).toBe("do_not_scale_treatment");
  });

  it("preserves strata for downstream regression or ML without treating model output as causal authority", () => {
    const rows = buildCreativeExperimentFeatureRows([
      {
        variantId: "creative:control",
        stratum: "monday",
        exposures: 1000,
        clicks: 100,
        conversions: 40,
        payments: 35,
        spend: 250,
        contributionMargin: 600,
        observedAt: "2026-09-22T18:00:00.000Z",
        evidenceRefs: ["meta:day:monday"],
      },
      {
        variantId: "creative:treatment",
        stratum: "monday",
        exposures: 1000,
        clicks: 130,
        conversions: 55,
        payments: 48,
        spend: 260,
        contributionMargin: 760,
        observedAt: "2026-09-22T18:00:00.000Z",
        evidenceRefs: ["meta:day:monday:treatment"],
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.stratum).toBe("monday");
  });
});
