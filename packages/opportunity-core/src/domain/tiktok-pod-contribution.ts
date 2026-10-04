import type { Opportunity } from "./opportunity.js";
import {
  calculateOpportunityOutcome,
  type OpportunityOutcome,
} from "./outcome.js";
import type {
  SideHustleExperiment,
  SideHustleExperimentEvaluation,
} from "./side-hustle-experiment.js";
import { isSideHustleProfile } from "./side-hustles.js";

export type TikTokPodSettlementKind =
  | "sale_settlement"
  | "refund"
  | "chargeback"
  | "platform_fee"
  | "affiliate_commission"
  | "promotion_fee"
  | "fulfillment_cost"
  | "shipping_cost";

export type TikTokPodSettlementObservation = {
  id: string;
  opportunityId: string;
  externalTransactionRef: string;
  orderRef?: string;
  kind: TikTokPodSettlementKind;
  amount: number;
  currency: string;
  sourceRef: string;
  evidenceRefs: string[];
  occurredAt: string;
};

export type TikTokPodContributionProof = {
  id: string;
  opportunityId: string;
  experimentId: string;
  currency: string;
  status: "passed" | "blocked";
  calculation: OpportunityOutcome;
  settlementIds: string[];
  blockers: string[];
  evidenceRefs: string[];
  evaluatedAt: string;
  canonicalOutcomePersisted: false;
  authority: "TIKTOK_POD_CONTRIBUTION_ANALYTICS_ONLY";
  externalActionAuthorized: false;
  publishingAuthorized: false;
  paymentAuthorized: false;
  moneyMovementAuthorized: false;
};

export function buildTikTokPodContributionProof(input: {
  opportunity: Opportunity;
  experiment: SideHustleExperiment;
  evaluation: SideHustleExperimentEvaluation;
  settlements: readonly TikTokPodSettlementObservation[];
  currency: string;
  evaluatedAt: string;
}): TikTokPodContributionProof {
  const profile = input.opportunity.metadata?.sideHustleProfile;
  if (
    !isSideHustleProfile(profile) ||
    profile.family !== "pod_personalized_commerce"
  ) {
    throw new Error(
      "TikTok POD contribution proof requires pod_personalized_commerce Opportunity",
    );
  }
  if (
    input.experiment.opportunityId !== input.opportunity.id ||
    input.experiment.profile.family !== "pod_personalized_commerce"
  ) {
    throw new Error("TikTok POD experiment does not match opportunity");
  }
  if (
    input.experiment.status !== "completed" ||
    !input.experiment.startedAt ||
    !input.experiment.completedAt
  ) {
    throw new Error("TikTok POD contribution proof requires completed experiment");
  }
  if (
    input.evaluation.experimentId !== input.experiment.id ||
    input.evaluation.opportunityId !== input.opportunity.id
  ) {
    throw new Error("TikTok POD evaluation does not match experiment");
  }

  const currency = requireCurrency(input.currency);
  const evaluatedAt = normalizeDate(input.evaluatedAt, "evaluatedAt");
  const startedAt = normalizeDate(input.experiment.startedAt, "startedAt");
  const completedAt = normalizeDate(input.experiment.completedAt, "completedAt");
  if (Date.parse(evaluatedAt) < Date.parse(completedAt)) {
    throw new Error("TikTok POD contribution cannot be evaluated before experiment completion");
  }
  if (input.experiment.currency.trim().toUpperCase() !== currency) {
    throw new Error("TikTok POD contribution currency must match experiment currency");
  }

  const settlements = dedupeSettlements(input.settlements).filter((settlement) => {
    const time = Date.parse(settlement.occurredAt);
    return time >= Date.parse(startedAt) && time <= Date.parse(evaluatedAt);
  });
  if (settlements.some((settlement) => settlement.opportunityId !== input.opportunity.id)) {
    throw new Error("TikTok POD settlements must belong to one opportunity");
  }
  if (settlements.some((settlement) => settlement.currency !== currency)) {
    throw new Error("TikTok POD settlement FX inference is not allowed");
  }

  const blockers: string[] = [];
  if (input.evaluation.decision !== "promote") {
    blockers.push(
      `bounded experiment decision is ${input.evaluation.decision}, not promote`,
    );
  }
  if (input.evaluation.observationCount < 1) {
    blockers.push("bounded experiment has no observations");
  }

  const grossRevenue = money(
    sum(settlements, "sale_settlement"),
  );
  const refunds = money(
    sum(settlements, "refund") + sum(settlements, "chargeback"),
  );
  const directSettlementCosts = money(
    sum(settlements, "fulfillment_cost") + sum(settlements, "shipping_cost"),
  );
  const fees = money(
    sum(settlements, "platform_fee") +
      sum(settlements, "affiliate_commission") +
      sum(settlements, "promotion_fee"),
  );
  if (grossRevenue <= 0) {
    blockers.push("no settled seller revenue exists for the experiment window");
  }

  const evidenceRefs = unique([
    ...input.experiment.evidenceRefs,
    ...input.evaluation.evidenceRefs,
    ...settlements.flatMap((settlement) => settlement.evidenceRefs),
    ...settlements.map((settlement) => settlement.sourceRef),
  ]);

  const outcomeBase = {
    id: `tiktok-pod-contribution:${sanitize(input.experiment.id)}:${currency}:${sanitize(completedAt)}`,
    opportunityId: input.opportunity.id,
    currency,
    grossRevenue,
    refunds,
    directCosts: money(directSettlementCosts + input.evaluation.totalSpend),
    fees,
    hours: money(input.evaluation.totalHours),
    sourceOwner: "commerce" as const,
    evidenceRefs: evidenceRefs.length ? evidenceRefs : [input.experiment.id],
    transactionRefs: unique(
      settlements.map((settlement) => settlement.externalTransactionRef),
    ),
    observedAt: evaluatedAt,
    notes:
      "Realized TikTok POD seller contribution from settlement evidence; modeled listing margin is not used as revenue.",
  };

  let calculation = calculateOpportunityOutcome({
    ...outcomeBase,
    result: "won",
  });
  if (calculation.profit <= 0) {
    calculation = calculateOpportunityOutcome({
      ...outcomeBase,
      result: "lost",
    });
    blockers.push(
      `non-positive contribution: ${calculation.profit.toFixed(2)} ${currency}`,
    );
  }

  return {
    id: outcomeBase.id,
    opportunityId: input.opportunity.id,
    experimentId: input.experiment.id,
    currency,
    status:
      blockers.length === 0 && calculation.profit > 0 ? "passed" : "blocked",
    calculation,
    settlementIds: settlements.map((settlement) => settlement.id),
    blockers: unique(blockers),
    evidenceRefs: outcomeBase.evidenceRefs,
    evaluatedAt,
    canonicalOutcomePersisted: false,
    authority: "TIKTOK_POD_CONTRIBUTION_ANALYTICS_ONLY",
    externalActionAuthorized: false,
    publishingAuthorized: false,
    paymentAuthorized: false,
    moneyMovementAuthorized: false,
  };
}

function dedupeSettlements(
  settlements: readonly TikTokPodSettlementObservation[],
): TikTokPodSettlementObservation[] {
  const byKey = new Map<string, TikTokPodSettlementObservation>();
  for (const raw of settlements) {
    const settlement = assertSettlement(raw);
    const key = [
      settlement.opportunityId,
      settlement.externalTransactionRef,
      settlement.kind,
    ].join("|");
    const prior = byKey.get(key);
    if (!prior || Date.parse(settlement.occurredAt) >= Date.parse(prior.occurredAt)) {
      byKey.set(key, settlement);
    }
  }
  return [...byKey.values()];
}

function assertSettlement(
  settlement: TikTokPodSettlementObservation,
): TikTokPodSettlementObservation {
  if (
    !settlement.id.trim() ||
    !settlement.opportunityId.trim() ||
    !settlement.externalTransactionRef.trim() ||
    !settlement.sourceRef.trim()
  ) {
    throw new Error("TikTok POD settlement identity is incomplete");
  }
  if (!Number.isFinite(settlement.amount) || settlement.amount < 0) {
    throw new Error("TikTok POD settlement amount must be non-negative");
  }
  const currency = requireCurrency(settlement.currency);
  const occurredAt = normalizeDate(settlement.occurredAt, "settlement.occurredAt");
  const evidenceRefs = unique(settlement.evidenceRefs);
  if (!evidenceRefs.length) {
    throw new Error("TikTok POD settlement evidence is required");
  }
  return {
    ...settlement,
    currency,
    occurredAt,
    evidenceRefs,
  };
}

function sum(
  settlements: TikTokPodSettlementObservation[],
  kind: TikTokPodSettlementKind,
): number {
  return settlements
    .filter((settlement) => settlement.kind === kind)
    .reduce((total, settlement) => total + settlement.amount, 0);
}

function requireCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("TikTok POD contribution currency must be a 3-letter code");
  }
  return currency;
}

function normalizeDate(value: string, field: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid date`);
  return new Date(parsed).toISOString();
}

function sanitize(value: string): string {
  return value.replace(/[^0-9A-Za-z:_-]/g, "").slice(-96);
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
