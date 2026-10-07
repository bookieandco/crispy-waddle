import { describe, expect, it } from "vitest";
import {
  assessPaidAccelerationReadiness,
  compileAcceleratedPortfolioPaidExperiment,
} from "./social-paid-acceleration-readiness.js";

const base = {
  brandId: "brand:pupsonstuff",
  proof: {
    offerRef: "offer:pupson:portrait",
    qualifiedConversions: 3,
    repeatOrReferralSignals: 0,
    winningContentPieces: 2,
    distinctSharedSurfaces: 1,
    evidenceRefs: ["organic:sales:3", "creative:winners:2"],
  },
  owned: {
    destinationRef: "storefront:pupsonstuff",
    consentedCaptureReady: true,
    nurtureReady: true,
    consentedAudienceCount: 120,
    evidenceRefs: ["owned:storefront", "owned:email-list"],
  },
  economics: {
    currency: "USD",
    customerLifetimeValueMinor: 12000,
    contributionPerCustomerMinor: 7000,
    maxAcquisitionCostMinor: 3000,
    evidenceRefs: ["economics:pupson"],
  },
  peso: {
    sharedRefs: ["instagram:organic:post:1"],
    ownedRefs: ["storefront:pupsonstuff", "email:pupson"],
    earnedRefs: [],
  },
} as const;

describe("paid acceleration readiness", () => {
  it("holds paid media when a new offer has no qualified organic proof", () => {
    const readiness = assessPaidAccelerationReadiness({
      ...base,
      proof: {
        ...base.proof,
        qualifiedConversions: 0,
        winningContentPieces: 0,
      },
    });

    expect(readiness.status).toBe("ORGANIC_PROOF_REQUIRED");
    expect(readiness.eligibleForBoundedPaidTest).toBe(false);
    expect(readiness.blockers).toContain(
      "QUALIFIED_ORGANIC_PROOF_INSUFFICIENT",
    );
    expect(readiness.policy.advertisingIsAcceleratorNotInitiator).toBe(true);
  });

  it("allows a bounded paid test after qualified organic proof and owned capture are ready", () => {
    const readiness = assessPaidAccelerationReadiness(base);

    expect(readiness.status).toBe("BOUNDED_PAID_TEST_READY");
    expect(readiness.eligibleForBoundedPaidTest).toBe(true);
    expect(readiness.eligibleForAcceleration).toBe(false);
    expect(readiness.peso.paid).toBe("bounded_test");
    expect(readiness.peso.earnedEvidencePresent).toBe(false);
  });

  it("promotes to acceleration only after stronger conversion and repeat/referral evidence", () => {
    const readiness = assessPaidAccelerationReadiness({
      ...base,
      proof: {
        ...base.proof,
        qualifiedConversions: 14,
        repeatOrReferralSignals: 3,
        winningContentPieces: 4,
      },
    });

    expect(readiness.status).toBe("PAID_ACCELERATION_READY");
    expect(readiness.eligibleForAcceleration).toBe(true);
    expect(readiness.peso.paid).toBe("accelerate");
  });

  it("blocks paid when owned capture or unit economics are not ready", () => {
    const readiness = assessPaidAccelerationReadiness({
      ...base,
      owned: {
        ...base.owned,
        consentedCaptureReady: false,
      },
      economics: {
        ...base.economics,
        maxAcquisitionCostMinor: 9000,
      },
    });

    expect(readiness.status).toBe("ORGANIC_PROOF_REQUIRED");
    expect(readiness.blockers).toContain("OWNED_CAPTURE_NOT_READY");
    expect(readiness.blockers).toContain("MAX_CAC_EXCEEDS_CONTRIBUTION");
  });

  it("uses earned media as helpful evidence but never as a requirement", () => {
    const withoutEarned = assessPaidAccelerationReadiness(base);
    const withEarned = assessPaidAccelerationReadiness({
      ...base,
      peso: {
        ...base.peso,
        earnedRefs: ["press:mention:1"],
      },
    });

    expect(withoutEarned.eligibleForBoundedPaidTest).toBe(true);
    expect(withoutEarned.peso.earnedEvidencePresent).toBe(false);
    expect(withEarned.peso.earnedEvidencePresent).toBe(true);
  });

  it("compiles the paid experiment only through an admitted readiness decision", () => {
    const readiness = assessPaidAccelerationReadiness(base);

    const plan = compileAcceleratedPortfolioPaidExperiment({
      readiness,
      experiment: {
        id: "experiment:pupson:meta:proof-first",
        brandId: base.brandId,
        channel: "meta",
        objective: "sales",
        audienceIds: ["audience:pupson:ready-buyers"],
        controlCreativeId: "creative:pupson:organic-winner",
        treatmentCreativeId: "creative:pupson:variant-b",
        testAxis: "creative",
        dailyBudgetMinor: 2500,
        lifetimeBudgetMinor: 10000,
        currency: "USD",
        landingPageRef: base.owned.destinationRef,
        evidenceRefs: ["weekly:approved:test"],
      },
    });

    expect(plan.authority).toBe("PAID_EXPERIMENT_PLAN_ONLY");
    expect(plan.evidenceRefs).toContain(
      "paid-acceleration-status:BOUNDED_PAID_TEST_READY",
    );
    expect(plan.policy.autoBudgetIncreaseAllowed).toBe(false);
  });

  it("cannot compile a paid experiment for an unproven offer", () => {
    const readiness = assessPaidAccelerationReadiness({
      ...base,
      proof: {
        ...base.proof,
        qualifiedConversions: 0,
        winningContentPieces: 0,
      },
    });

    expect(() => compileAcceleratedPortfolioPaidExperiment({
      readiness,
      experiment: {
        id: "experiment:pupson:meta:unproven",
        brandId: base.brandId,
        channel: "meta",
        objective: "sales",
        audienceIds: ["audience:pupson:ready-buyers"],
        controlCreativeId: "creative:a",
        treatmentCreativeId: "creative:b",
        testAxis: "creative",
        dailyBudgetMinor: 2500,
        lifetimeBudgetMinor: 10000,
        currency: "USD",
        landingPageRef: base.owned.destinationRef,
        evidenceRefs: ["proposal:unproven"],
      },
    })).toThrow(/ORGANIC_PROOF_REQUIRED/);
  });
});
