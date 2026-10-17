import { describe, expect, it } from "vitest";
import {
  assessPaidAccelerationReadiness,
} from "./social-paid-acceleration-readiness.js";
import {
  buildAudienceLanguageMap,
  buildOwnedAudienceCapturePlan,
  compileOrganicDemandSystem,
  selectPrimaryAcquisitionPlatform,
} from "./social-organic-demand-system.js";

const audience = buildAudienceLanguageMap({
  brandId: "brand:pupsonstuff",
  signals: [
    {
      id: "signal:pain:1",
      kind: "pain",
      text: "I want a pet gift that actually looks like my dog.",
      source: "public_comment",
      evidenceRefs: ["comment:pet:1"],
    },
    {
      id: "signal:desire:1",
      kind: "desire",
      text: "I want something personal enough to feel made for us.",
      source: "review",
      evidenceRefs: ["review:pet:1"],
    },
    {
      id: "signal:objection:1",
      kind: "objection",
      text: "AI pet art usually changes the face too much.",
      source: "public_forum",
      evidenceRefs: ["forum:pet:1"],
    },
    {
      id: "signal:question:1",
      kind: "question",
      text: "Can I use more than one photo?",
      source: "first_party_support",
      evidenceRefs: ["support:pet:1"],
    },
  ],
});

const platform = selectPrimaryAcquisitionPlatform({
  candidates: [
    {
      platform: "instagram",
      audienceFit: 0.95,
      operatorFit: 0.9,
      discoveryLongevity: 0.4,
      nativeFormatFit: 0.95,
      commercialEvidence: 0.8,
      evidenceRefs: ["platform:instagram:pupson"],
    },
    {
      platform: "pinterest",
      audienceFit: 0.82,
      operatorFit: 0.75,
      discoveryLongevity: 0.95,
      nativeFormatFit: 0.78,
      commercialEvidence: 0.7,
      evidenceRefs: ["platform:pinterest:pupson"],
    },
    {
      platform: "youtube",
      audienceFit: 0.6,
      operatorFit: 0.45,
      discoveryLongevity: 0.98,
      nativeFormatFit: 0.55,
      commercialEvidence: 0.5,
      evidenceRefs: ["platform:youtube:pupson"],
    },
  ],
});

const ownedCapture = buildOwnedAudienceCapturePlan({
  destinationRef: "storefront:pupsonstuff",
  leadMagnetRef: "lead-magnet:pet-photo-checklist",
  consentCaptureRef: "form:pupson:email",
  nurtureSequenceRef: "email-sequence:pupson:new-lead",
  nurtureTouchCount: 5,
  evidenceRefs: ["owned:pupson:lead-capture"],
});

describe("organic demand system", () => {
  it("builds customer-language research only from evidence-backed signals", () => {
    expect(audience.pains).toEqual([
      "I want a pet gift that actually looks like my dog.",
    ]);
    expect(audience.objections).toContain(
      "AI pet art usually changes the face too much.",
    );
    expect(audience.policy.inventedPainPointsAllowed).toBe(false);
    expect(audience.policy.sensitiveTraitInferenceAllowed).toBe(false);
  });

  it("selects one primary platform and treats the rest as repurpose surfaces", () => {
    expect(platform.primaryPlatform).toBe("instagram");
    expect(platform.repurposeSurfaces).toContain("pinterest");
    expect(platform.policy.onePrimaryAcquisitionSurfaceAtATime).toBe(true);
    expect(platform.policy.blindCrossPostingAllowed).toBe(false);
  });

  it("requires both brand-building and conversion content with an owned destination", () => {
    const plan = compileOrganicDemandSystem({
      brandId: "brand:pupsonstuff",
      audience,
      platform,
      ownedCapture,
      content: [
        {
          id: "content:brand:1",
          role: "brand",
          topic: "Why preserving the real pet identity matters",
          hook: "The tiny face details people notice immediately",
          audienceSignalRefs: ["signal:pain:1", "signal:desire:1"],
          ctaKind: "lead_capture",
          destinationRef: ownedCapture.leadMagnetRef,
          faceless: true,
          visualIdentityRef: "visual:pupson:recognizable:v1",
          evidenceRefs: ["creative:brand:1"],
        },
        {
          id: "content:conversion:1",
          role: "conversion",
          topic: "How multi-photo identity improves portrait accuracy",
          hook: "One photo can miss the thing you love most",
          audienceSignalRefs: ["signal:objection:1", "signal:question:1"],
          ctaKind: "offer",
          destinationRef: ownedCapture.destinationRef,
          faceless: true,
          visualIdentityRef: "visual:pupson:recognizable:v1",
          evidenceRefs: ["creative:conversion:1"],
        },
      ],
      evidenceRefs: ["strategy:pupson:organic"],
    });

    expect(plan.peso.shared).toBe("active");
    expect(plan.peso.owned).toBe("priority");
    expect(plan.peso.paid).toBe("hold");
    expect(plan.policy.contentBeforePaid).toBe(true);
    expect(plan.policy.brandAndConversionContentBothRequired).toBe(true);
    expect(plan.ownedCapture.policy.explicitConsentRequired).toBe(true);
  });

  it("rejects a content calendar made only of awareness/brand content", () => {
    expect(() => compileOrganicDemandSystem({
      brandId: "brand:pupsonstuff",
      audience,
      platform,
      ownedCapture,
      content: [{
        id: "content:brand-only",
        role: "brand",
        topic: "Pet stories",
        hook: "The funniest dog face this week",
        audienceSignalRefs: ["signal:desire:1"],
        ctaKind: "engage",
        destinationRef: "social:instagram:pupsonstuff",
        evidenceRefs: ["creative:brand-only"],
      }],
      evidenceRefs: ["strategy:brand-only"],
    })).toThrow(/CONVERSION_CONTENT_REQUIRED/);
  });

  it("rejects faceless creative without a recognizable visual identity", () => {
    expect(() => compileOrganicDemandSystem({
      brandId: "brand:pupsonstuff",
      audience,
      platform,
      ownedCapture,
      content: [
        {
          id: "content:brand:faceless",
          role: "brand",
          topic: "Pet story",
          hook: "A recognizable recurring story format",
          audienceSignalRefs: ["signal:desire:1"],
          ctaKind: "lead_capture",
          destinationRef: ownedCapture.leadMagnetRef,
          faceless: true,
          evidenceRefs: ["creative:faceless"],
        },
        {
          id: "content:conversion:faceless",
          role: "conversion",
          topic: "Product demonstration",
          hook: "See the likeness before ordering",
          audienceSignalRefs: ["signal:objection:1"],
          ctaKind: "offer",
          destinationRef: ownedCapture.destinationRef,
          evidenceRefs: ["creative:conversion"],
        },
      ],
      evidenceRefs: ["strategy:faceless"],
    })).toThrow(/FACELESS_VISUAL_IDENTITY_REQUIRED/);
  });

  it("changes PESO paid state only when the paid-readiness gate admits it", () => {
    const readiness = assessPaidAccelerationReadiness({
      brandId: "brand:pupsonstuff",
      proof: {
        offerRef: "offer:pupson:portrait",
        qualifiedConversions: 12,
        repeatOrReferralSignals: 2,
        winningContentPieces: 4,
        distinctSharedSurfaces: 2,
        evidenceRefs: ["organic:proof"],
      },
      owned: {
        destinationRef: ownedCapture.destinationRef,
        consentedCaptureReady: true,
        nurtureReady: true,
        consentedAudienceCount: 200,
        evidenceRefs: ["owned:proof"],
      },
      economics: {
        currency: "USD",
        customerLifetimeValueMinor: 12000,
        contributionPerCustomerMinor: 7000,
        maxAcquisitionCostMinor: 3000,
        evidenceRefs: ["economics:proof"],
      },
      peso: {
        sharedRefs: ["instagram:winner", "pinterest:winner"],
        ownedRefs: ["storefront:pupsonstuff", "email:pupson"],
        earnedRefs: ["customer:referral:1"],
      },
      auction: {
        provider: "meta",
        channel: "meta",
        audienceMessageFitEvidenceRefs: ["meta:audience-fit"],
        creativeQualityEvidenceRefs: ["meta:creative-quality"],
        estimatedActionRateEvidenceRefs: ["meta:action-rate"],
        learningBudgetMinor: 10000,
        minimumLearningBudgetMinor: 7500,
        negativeFeedbackRate: 0.01,
        maximumNegativeFeedbackRate: 0.03,
        evidenceRefs: ["meta:auction-proof"],
      },
    });

    const plan = compileOrganicDemandSystem({
      brandId: "brand:pupsonstuff",
      audience,
      platform,
      ownedCapture,
      paidReadiness: readiness,
      content: [
        {
          id: "content:brand:2",
          role: "brand",
          topic: "Customer pet story",
          hook: "The detail that made this owner recognize their dog",
          audienceSignalRefs: ["signal:pain:1"],
          ctaKind: "lead_capture",
          destinationRef: ownedCapture.leadMagnetRef,
          evidenceRefs: ["creative:brand:2"],
        },
        {
          id: "content:conversion:2",
          role: "conversion",
          topic: "Multi-photo demonstration",
          hook: "Why several references improve consistency",
          audienceSignalRefs: ["signal:objection:1"],
          ctaKind: "offer",
          destinationRef: ownedCapture.destinationRef,
          evidenceRefs: ["creative:conversion:2"],
        },
      ],
      evidenceRefs: ["strategy:pupson:accelerate"],
    });

    expect(readiness.status).toBe("PAID_ACCELERATION_READY");
    expect(plan.peso.paid).toBe("accelerate");
  });
});
