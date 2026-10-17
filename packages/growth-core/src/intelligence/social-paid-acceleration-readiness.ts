import type { GrowthId } from "../domain/types.js";
import {
  compilePortfolioPaidExperiment,
  type PortfolioPaidExperimentPlan,
} from "./social-portfolio-autopilot.js";

export type PESOMediaClass = "paid" | "earned" | "shared" | "owned";

export interface PESOEvidence {
  paidRefs?: readonly string[];
  earnedRefs?: readonly string[];
  sharedRefs: readonly string[];
  ownedRefs: readonly string[];
}

export interface OrganicOfferProof {
  offerRef: string;
  qualifiedConversions: number;
  repeatOrReferralSignals: number;
  winningContentPieces: number;
  distinctSharedSurfaces: number;
  evidenceRefs: readonly string[];
}

export interface OwnedAudienceReadiness {
  destinationRef: string;
  consentedCaptureReady: boolean;
  nurtureReady: boolean;
  consentedAudienceCount: number;
  evidenceRefs: readonly string[];
}

export interface PaidUnitEconomics {
  currency: string;
  customerLifetimeValueMinor: number;
  contributionPerCustomerMinor: number;
  maxAcquisitionCostMinor: number;
  evidenceRefs: readonly string[];
}

export interface PaidAuctionReadinessEvidence {
  provider: string;
  channel: string;
  audienceMessageFitEvidenceRefs: readonly string[];
  creativeQualityEvidenceRefs: readonly string[];
  estimatedActionRateEvidenceRefs: readonly string[];
  learningBudgetMinor: number;
  minimumLearningBudgetMinor: number;
  negativeFeedbackRate?: number;
  maximumNegativeFeedbackRate?: number;
  evidenceRefs: readonly string[];
}

export interface PaidAccelerationThresholds {
  minimumQualifiedConversionsForTest: number;
  minimumQualifiedConversionsForAcceleration: number;
  minimumWinningContentPiecesForTest: number;
  minimumWinningContentPiecesForAcceleration: number;
  minimumDistinctSharedSurfaces: number;
  requireRepeatOrReferralSignalForAcceleration: boolean;
}

export type PaidAccelerationStatus =
  | "ORGANIC_PROOF_REQUIRED"
  | "BOUNDED_PAID_TEST_READY"
  | "PAID_ACCELERATION_READY";

export interface PaidAccelerationReadiness {
  brandId: GrowthId;
  offerRef: string;
  status: PaidAccelerationStatus;
  eligibleForBoundedPaidTest: boolean;
  eligibleForAcceleration: boolean;
  blockers: readonly string[];
  strengths: readonly string[];
  thresholds: Readonly<PaidAccelerationThresholds>;
  evidenceRefs: readonly string[];
  peso: Readonly<{
    paid: "hold" | "bounded_test" | "accelerate";
    earnedEvidencePresent: boolean;
    sharedEvidencePresent: boolean;
    ownedEvidencePresent: boolean;
    ownedAudienceCaptureReady: boolean;
  }>;
  auction: Readonly<{
    providerEvidencePresent: boolean;
    audienceMessageFitPresent: boolean;
    creativeQualityPresent: boolean;
    estimatedActionRateEvidencePresent: boolean;
    learningBudgetAdequate: boolean;
    negativeFeedbackWithinBound: boolean;
  }>;
  policy: Readonly<{
    advertisingIsAcceleratorNotInitiator: true;
    paidRequiresQualifiedOrganicProof: true;
    sharedProofRequired: true;
    ownedDestinationAndCaptureRequired: true;
    earnedMediaHelpfulButNotRequired: true;
    knownUnitEconomicsRequired: true;
    auctionMechanicsAreProviderSpecific: true;
    auctionEvidenceRequiredForAcceleration: true;
    adequateLearningBudgetRequiredForAcceleration: true;
    adQualityAndRelevanceRequiredForAcceleration: true;
    vanityMetricsAloneCannotUnlockPaid: true;
    autoBudgetIncreaseAllowed: false;
    paidSpendAuthority: "NONE";
  }>;
  authority: "PAID_ACCELERATION_ADMISSION_ONLY";
}

const DEFAULT_THRESHOLDS: PaidAccelerationThresholds = Object.freeze({
  minimumQualifiedConversionsForTest: 3,
  minimumQualifiedConversionsForAcceleration: 10,
  minimumWinningContentPiecesForTest: 2,
  minimumWinningContentPiecesForAcceleration: 3,
  minimumDistinctSharedSurfaces: 1,
  requireRepeatOrReferralSignalForAcceleration: true,
});

export function assessPaidAccelerationReadiness(input: {
  brandId: GrowthId;
  proof: OrganicOfferProof;
  owned: OwnedAudienceReadiness;
  economics: PaidUnitEconomics;
  peso: PESOEvidence;
  auction?: PaidAuctionReadinessEvidence;
  thresholds?: Partial<PaidAccelerationThresholds>;
}): PaidAccelerationReadiness {
  requireText(input.brandId, "brandId");
  requireText(input.proof.offerRef, "offerRef");

  const thresholds = Object.freeze({
    ...DEFAULT_THRESHOLDS,
    ...(input.thresholds ?? {}),
  });
  validateThresholds(thresholds);
  validateNonNegativeInteger(input.proof.qualifiedConversions, "qualifiedConversions");
  validateNonNegativeInteger(input.proof.repeatOrReferralSignals, "repeatOrReferralSignals");
  validateNonNegativeInteger(input.proof.winningContentPieces, "winningContentPieces");
  validateNonNegativeInteger(input.proof.distinctSharedSurfaces, "distinctSharedSurfaces");
  validateNonNegativeInteger(input.owned.consentedAudienceCount, "consentedAudienceCount");
  validateMoney(input.economics.customerLifetimeValueMinor, "customerLifetimeValueMinor");
  validateMoney(input.economics.contributionPerCustomerMinor, "contributionPerCustomerMinor");
  validateMoney(input.economics.maxAcquisitionCostMinor, "maxAcquisitionCostMinor");
  if (!/^[A-Z]{3}$/.test(input.economics.currency)) {
    throw new Error("GROWTH_PAID_ACCELERATION_CURRENCY_INVALID");
  }

  const evidenceRefs = unique([
    ...input.proof.evidenceRefs,
    ...input.owned.evidenceRefs,
    ...input.economics.evidenceRefs,
    ...(input.peso.paidRefs ?? []),
    ...(input.peso.earnedRefs ?? []),
    ...input.peso.sharedRefs,
    ...input.peso.ownedRefs,
    ...(input.auction?.audienceMessageFitEvidenceRefs ?? []),
    ...(input.auction?.creativeQualityEvidenceRefs ?? []),
    ...(input.auction?.estimatedActionRateEvidenceRefs ?? []),
    ...(input.auction?.evidenceRefs ?? []),
  ]);
  if (!evidenceRefs.length) {
    throw new Error("GROWTH_PAID_ACCELERATION_EVIDENCE_REQUIRED");
  }

  const blockers: string[] = [];
  const strengths: string[] = [];
  if (input.auction) {
    requireText(input.auction.provider, "auction.provider");
    requireText(input.auction.channel, "auction.channel");
    validateMoney(input.auction.learningBudgetMinor, "auction.learningBudgetMinor");
    validateMoney(
      input.auction.minimumLearningBudgetMinor,
      "auction.minimumLearningBudgetMinor",
    );
    if (
      input.auction.negativeFeedbackRate !== undefined
      && (
        !Number.isFinite(input.auction.negativeFeedbackRate)
        || input.auction.negativeFeedbackRate < 0
        || input.auction.negativeFeedbackRate > 1
      )
    ) {
      throw new Error("GROWTH_PAID_AUCTION_NEGATIVE_FEEDBACK_INVALID");
    }
    if (
      input.auction.maximumNegativeFeedbackRate !== undefined
      && (
        !Number.isFinite(input.auction.maximumNegativeFeedbackRate)
        || input.auction.maximumNegativeFeedbackRate < 0
        || input.auction.maximumNegativeFeedbackRate > 1
      )
    ) {
      throw new Error("GROWTH_PAID_AUCTION_NEGATIVE_FEEDBACK_BOUND_INVALID");
    }
  }


  const auctionEvidencePresent =
    Boolean(input.auction)
    && (input.auction?.evidenceRefs.length ?? 0) > 0;
  const audienceMessageFitPresent =
    (input.auction?.audienceMessageFitEvidenceRefs.length ?? 0) > 0;
  const creativeQualityPresent =
    (input.auction?.creativeQualityEvidenceRefs.length ?? 0) > 0;
  const estimatedActionRateEvidencePresent =
    (input.auction?.estimatedActionRateEvidenceRefs.length ?? 0) > 0;
  const learningBudgetAdequate =
    Boolean(input.auction)
    && (input.auction?.learningBudgetMinor ?? 0)
      >= (input.auction?.minimumLearningBudgetMinor ?? Number.MAX_SAFE_INTEGER);
  const negativeFeedbackWithinBound =
    !input.auction
    || input.auction.negativeFeedbackRate === undefined
    || input.auction.maximumNegativeFeedbackRate === undefined
    || input.auction.negativeFeedbackRate
      <= input.auction.maximumNegativeFeedbackRate;

  const sharedEvidencePresent = input.peso.sharedRefs.length > 0;
  const ownedEvidencePresent =
    input.peso.ownedRefs.length > 0
    && input.owned.evidenceRefs.length > 0;
  const organicProofEvidencePresent = input.proof.evidenceRefs.length > 0;
  const economicsEvidencePresent = input.economics.evidenceRefs.length > 0;
  const economicsKnown =
    economicsEvidencePresent
    && input.economics.customerLifetimeValueMinor > 0
    && input.economics.contributionPerCustomerMinor > 0
    && input.economics.maxAcquisitionCostMinor > 0;

  if (!organicProofEvidencePresent) {
    blockers.push("ORGANIC_PROOF_EVIDENCE_MISSING");
  }

  if (!sharedEvidencePresent) blockers.push("SHARED_MEDIA_PROOF_MISSING");
  else strengths.push("SHARED_MEDIA_PROOF_PRESENT");

  if (
    input.proof.distinctSharedSurfaces
    < thresholds.minimumDistinctSharedSurfaces
  ) {
    blockers.push("SHARED_MEDIA_SURFACE_PROOF_TOO_THIN");
  }

  if (!input.owned.destinationRef.trim()) {
    blockers.push("OWNED_DESTINATION_MISSING");
  } else {
    strengths.push("OWNED_DESTINATION_PRESENT");
  }
  if (!ownedEvidencePresent) {
    blockers.push("OWNED_EVIDENCE_MISSING");
  }

  if (!input.owned.consentedCaptureReady) {
    blockers.push("OWNED_CAPTURE_NOT_READY");
  } else {
    strengths.push("CONSENTED_CAPTURE_READY");
  }

  if (!input.owned.nurtureReady) {
    blockers.push("OWNED_NURTURE_NOT_READY");
  } else {
    strengths.push("OWNED_NURTURE_READY");
  }

  if (!economicsEvidencePresent) {
    blockers.push("UNIT_ECONOMICS_EVIDENCE_MISSING");
  }
  if (!economicsKnown) {
    blockers.push("UNIT_ECONOMICS_UNKNOWN");
  } else if (
    input.economics.maxAcquisitionCostMinor
    > input.economics.contributionPerCustomerMinor
  ) {
    blockers.push("MAX_CAC_EXCEEDS_CONTRIBUTION");
  } else {
    strengths.push("UNIT_ECONOMICS_WITHIN_CONTRIBUTION");
  }

  const testProof =
    organicProofEvidencePresent
    && input.proof.qualifiedConversions
      >= thresholds.minimumQualifiedConversionsForTest
    && input.proof.winningContentPieces
      >= thresholds.minimumWinningContentPiecesForTest;

  if (!testProof) {
    blockers.push("QUALIFIED_ORGANIC_PROOF_INSUFFICIENT");
  } else {
    strengths.push("QUALIFIED_ORGANIC_PROOF_PRESENT");
  }

  const operationallyReady =
    organicProofEvidencePresent
    && sharedEvidencePresent
    && ownedEvidencePresent
    && Boolean(input.owned.destinationRef.trim())
    && input.owned.consentedCaptureReady
    && input.owned.nurtureReady
    && economicsKnown
    && input.economics.maxAcquisitionCostMinor
      <= input.economics.contributionPerCustomerMinor
    && input.proof.distinctSharedSurfaces
      >= thresholds.minimumDistinctSharedSurfaces;

  const eligibleForBoundedPaidTest = operationallyReady && testProof;

  if (!auctionEvidencePresent) blockers.push("PAID_AUCTION_EVIDENCE_MISSING");
  else strengths.push("PAID_AUCTION_EVIDENCE_PRESENT");
  if (!audienceMessageFitPresent) blockers.push("PAID_AUDIENCE_MESSAGE_FIT_UNPROVEN");
  else strengths.push("PAID_AUDIENCE_MESSAGE_FIT_PRESENT");
  if (!creativeQualityPresent) blockers.push("PAID_CREATIVE_QUALITY_UNPROVEN");
  else strengths.push("PAID_CREATIVE_QUALITY_PRESENT");
  if (!estimatedActionRateEvidencePresent) {
    blockers.push("PAID_ESTIMATED_ACTION_RATE_EVIDENCE_MISSING");
  } else {
    strengths.push("PAID_ESTIMATED_ACTION_RATE_EVIDENCE_PRESENT");
  }
  if (!learningBudgetAdequate) blockers.push("PAID_LEARNING_BUDGET_INADEQUATE");
  else strengths.push("PAID_LEARNING_BUDGET_ADEQUATE");
  if (!negativeFeedbackWithinBound) blockers.push("PAID_NEGATIVE_FEEDBACK_TOO_HIGH");

  const accelerationProof =
    eligibleForBoundedPaidTest
    && auctionEvidencePresent
    && audienceMessageFitPresent
    && creativeQualityPresent
    && estimatedActionRateEvidencePresent
    && learningBudgetAdequate
    && negativeFeedbackWithinBound
    && input.proof.qualifiedConversions
      >= thresholds.minimumQualifiedConversionsForAcceleration
    && input.proof.winningContentPieces
      >= thresholds.minimumWinningContentPiecesForAcceleration
    && (
      !thresholds.requireRepeatOrReferralSignalForAcceleration
      || input.proof.repeatOrReferralSignals > 0
    );

  const status: PaidAccelerationStatus = accelerationProof
    ? "PAID_ACCELERATION_READY"
    : eligibleForBoundedPaidTest
      ? "BOUNDED_PAID_TEST_READY"
      : "ORGANIC_PROOF_REQUIRED";

  return Object.freeze({
    brandId: input.brandId,
    offerRef: input.proof.offerRef,
    status,
    eligibleForBoundedPaidTest,
    eligibleForAcceleration: accelerationProof,
    blockers: Object.freeze(unique(blockers)),
    strengths: Object.freeze(unique(strengths)),
    thresholds,
    evidenceRefs: Object.freeze(evidenceRefs),
    peso: Object.freeze({
      paid: status === "PAID_ACCELERATION_READY"
        ? "accelerate" as const
        : status === "BOUNDED_PAID_TEST_READY"
          ? "bounded_test" as const
          : "hold" as const,
      earnedEvidencePresent: (input.peso.earnedRefs?.length ?? 0) > 0,
      sharedEvidencePresent,
      ownedEvidencePresent,
      ownedAudienceCaptureReady: input.owned.consentedCaptureReady,
    }),
    auction: Object.freeze({
      providerEvidencePresent: auctionEvidencePresent,
      audienceMessageFitPresent,
      creativeQualityPresent,
      estimatedActionRateEvidencePresent,
      learningBudgetAdequate,
      negativeFeedbackWithinBound,
    }),
    policy: Object.freeze({
      advertisingIsAcceleratorNotInitiator: true as const,
      paidRequiresQualifiedOrganicProof: true as const,
      sharedProofRequired: true as const,
      ownedDestinationAndCaptureRequired: true as const,
      earnedMediaHelpfulButNotRequired: true as const,
      knownUnitEconomicsRequired: true as const,
      auctionMechanicsAreProviderSpecific: true as const,
      auctionEvidenceRequiredForAcceleration: true as const,
      adequateLearningBudgetRequiredForAcceleration: true as const,
      adQualityAndRelevanceRequiredForAcceleration: true as const,
      vanityMetricsAloneCannotUnlockPaid: true as const,
      autoBudgetIncreaseAllowed: false as const,
      paidSpendAuthority: "NONE" as const,
    }),
    authority: "PAID_ACCELERATION_ADMISSION_ONLY" as const,
  });
}

export function compileAcceleratedPortfolioPaidExperiment(input: {
  readiness: PaidAccelerationReadiness;
  experiment: Parameters<typeof compilePortfolioPaidExperiment>[0];
}): PortfolioPaidExperimentPlan {
  if (input.readiness.brandId !== input.experiment.brandId) {
    throw new Error("GROWTH_PAID_ACCELERATION_BRAND_MISMATCH");
  }
  if (!input.readiness.eligibleForBoundedPaidTest) {
    throw new Error(
      "GROWTH_PAID_ACCELERATION_ORGANIC_PROOF_REQUIRED:"
      + input.readiness.blockers.join(","),
    );
  }

  return compilePortfolioPaidExperiment({
    ...input.experiment,
    evidenceRefs: unique([
      ...input.experiment.evidenceRefs,
      ...input.readiness.evidenceRefs,
      "paid-acceleration-status:" + input.readiness.status,
      "paid-acceleration-offer:" + input.readiness.offerRef,
    ]),
  });
}

function validateThresholds(
  value: PaidAccelerationThresholds,
): void {
  for (const [name, threshold] of Object.entries(value)) {
    if (name === "requireRepeatOrReferralSignalForAcceleration") continue;
    if (!Number.isInteger(threshold) || Number(threshold) < 0) {
      throw new Error("GROWTH_PAID_ACCELERATION_THRESHOLD_INVALID:" + name);
    }
  }
  if (
    value.minimumQualifiedConversionsForAcceleration
      < value.minimumQualifiedConversionsForTest
    || value.minimumWinningContentPiecesForAcceleration
      < value.minimumWinningContentPiecesForTest
  ) {
    throw new Error("GROWTH_PAID_ACCELERATION_THRESHOLD_ORDER_INVALID");
  }
}

function validateNonNegativeInteger(
  value: number,
  name: string,
): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("GROWTH_PAID_ACCELERATION_COUNT_INVALID:" + name);
  }
}

function validateMoney(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("GROWTH_PAID_ACCELERATION_MONEY_INVALID:" + name);
  }
}

function requireText(value: string, name: string): void {
  if (!value.trim()) {
    throw new Error("GROWTH_PAID_ACCELERATION_FIELD_REQUIRED:" + name);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
