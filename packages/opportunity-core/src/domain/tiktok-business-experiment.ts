import type { Opportunity } from "./opportunity.js";
import {
  createSideHustleExperiment,
  recordSideHustleExperimentObservation,
  type SideHustleExperiment,
  type SideHustleExperimentObservation,
} from "./side-hustle-experiment.js";
import {
  proposeSideHustleExperiment,
  type SideHustleExperimentProposal,
} from "./side-hustle-experiment-proposal.js";
import { isSideHustleProfile } from "./side-hustles.js";

export type TikTokBusinessExperimentLane = "affiliate" | "pod_seller";

export type TikTokBoundedExperimentProposal =
  SideHustleExperimentProposal & {
    lane: TikTokBusinessExperimentLane;
    finalRevenueProof:
      | "PAID_AFFILIATE_PAYOUT_REQUIRED"
      | "SELLER_SETTLEMENT_REQUIRED";
    externalActionAuthorized: false;
    moneyMovementAuthorized: false;
  };

export function proposeTikTokBoundedExperiment(input: {
  opportunity: Opportunity;
  lane: TikTokBusinessExperimentLane;
  evidenceRefs: string[];
  targetCustomer?: string;
  offer?: string;
  generatedAt: string;
}): TikTokBoundedExperimentProposal {
  const profile = input.opportunity.metadata?.sideHustleProfile;
  if (!isSideHustleProfile(profile)) {
    throw new Error("TIKTOK_EXPERIMENT_PROFILE_REQUIRED");
  }
  const expectedFamily =
    input.lane === "affiliate"
      ? "commerce_affiliate"
      : "pod_personalized_commerce";
  if (profile.family !== expectedFamily) {
    throw new Error("TIKTOK_EXPERIMENT_LANE_FAMILY_MISMATCH");
  }

  const base = proposeSideHustleExperiment({
    opportunity: input.opportunity,
    evidenceRefs: input.evidenceRefs,
    targetCustomer: input.targetCustomer,
    offer: input.offer,
    maxSpend: input.lane === "affiliate" ? 50 : 100,
    maxHours: input.lane === "affiliate" ? 6 : 8,
    maxDurationDays: 14,
    generatedAt: input.generatedAt,
  });

  const successCriteria =
    input.lane === "affiliate"
      ? [
          {
            id: "qualified_clicks",
            metric: "qualified_clicks",
            operator: "gte" as const,
            threshold: 25,
            aggregation: "sum" as const,
            unit: "clicks",
          },
          {
            id: "attributed_conversions",
            metric: "attributed_conversions",
            operator: "gte" as const,
            threshold: 1,
            aggregation: "sum" as const,
            unit: "conversions",
          },
        ]
      : [
          {
            id: "qualified_visitors",
            metric: "qualified_visitors",
            operator: "gte" as const,
            threshold: 50,
            aggregation: "sum" as const,
            unit: "visitors",
          },
          {
            id: "paid_orders",
            metric: "paid_orders",
            operator: "gte" as const,
            threshold: 1,
            aggregation: "sum" as const,
            unit: "orders",
          },
        ];

  const killCriteria =
    input.lane === "affiliate"
      ? [
          {
            id: "policy_or_disclosure_violations",
            metric: "policy_or_disclosure_violations",
            operator: "gte" as const,
            threshold: 1,
            aggregation: "sum" as const,
            unit: "violations",
          },
          {
            id: "reversal_rate",
            metric: "reversal_rate",
            operator: "gte" as const,
            threshold: 0.5,
            aggregation: "max" as const,
            unit: "ratio",
          },
        ]
      : [
          {
            id: "fulfillment_breaches",
            metric: "fulfillment_breaches",
            operator: "gte" as const,
            threshold: 1,
            aggregation: "sum" as const,
            unit: "breaches",
          },
          {
            id: "refund_rate",
            metric: "refund_rate",
            operator: "gte" as const,
            threshold: 0.5,
            aggregation: "max" as const,
            unit: "ratio",
          },
        ];

  return Object.freeze({
    ...base,
    lane: input.lane,
    successCriteria: Object.freeze(successCriteria),
    killCriteria: Object.freeze(killCriteria),
    minimumObservations: input.lane === "affiliate" ? 25 : 50,
    assumptions: Object.freeze([
      ...base.assumptions,
      input.lane === "affiliate"
        ? "A promoted validation still requires provider-paid affiliate payout evidence before realized revenue is recognized."
        : "A promoted validation still requires seller settlement evidence before realized revenue is recognized.",
      "Creative generation and publication remain separate governed actions.",
    ]),
    finalRevenueProof:
      input.lane === "affiliate"
        ? "PAID_AFFILIATE_PAYOUT_REQUIRED"
        : "SELLER_SETTLEMENT_REQUIRED",
    externalActionAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  });
}

export function materializeTikTokBoundedExperimentPlan(input: {
  opportunity: Opportunity;
  proposal: TikTokBoundedExperimentProposal;
  reviewEvidenceRef: string;
  createdAt: string;
}): SideHustleExperiment {
  if (input.proposal.opportunityId !== input.opportunity.id) {
    throw new Error("TIKTOK_EXPERIMENT_PROPOSAL_OPPORTUNITY_MISMATCH");
  }
  if (!input.reviewEvidenceRef.trim()) {
    throw new Error("TIKTOK_EXPERIMENT_REVIEW_EVIDENCE_REQUIRED");
  }
  return createSideHustleExperiment({
    opportunity: input.opportunity,
    hypothesis: input.proposal.hypothesis,
    targetCustomer: input.proposal.targetCustomer,
    channel: input.proposal.channel,
    offer: input.proposal.offer,
    maxSpend: input.proposal.maxSpend,
    currency: input.proposal.currency,
    maxHours: input.proposal.maxHours,
    maxDurationDays: input.proposal.maxDurationDays,
    minimumObservations: input.proposal.minimumObservations,
    successCriteria: [...input.proposal.successCriteria],
    killCriteria: [...input.proposal.killCriteria],
    evidenceRefs: [
      ...input.proposal.evidenceRefs,
      input.reviewEvidenceRef,
    ],
    createdAt: input.createdAt,
  });
}

export function recordTikTokBoundedExperimentObservation(input: {
  experiment: SideHustleExperiment;
  id: string;
  observedAt: string;
  metrics: Record<string, number>;
  spend: number;
  hours: number;
  evidenceRefs: string[];
  notes?: string;
}): SideHustleExperimentObservation {
  return recordSideHustleExperimentObservation({
    experiment: input.experiment,
    observation: {
      id: input.id,
      experimentId: input.experiment.id,
      observedAt: input.observedAt,
      metrics: { ...input.metrics },
      spend: input.spend,
      hours: input.hours,
      evidenceRefs: [...input.evidenceRefs],
      notes: input.notes,
    },
  });
}
