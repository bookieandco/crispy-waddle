import type {
  DirectorHumanMediaBillingModel,
  DirectorHumanMediaExecutionCandidate,
  DirectorHumanMediaExecutionTier,
  DirectorHumanMediaRole,
  DirectorHumanMediaRuntimePolicy,
} from './local-human-media-stack.js';
import {
  DIRECTOR_LOCAL_FIRST_HUMAN_MEDIA_POLICY,
} from './local-human-media-stack.js';
import type {
  DirectorHumanMediaEngine,
  DirectorHumanMediaTaskKind,
} from './human-media-worker-contract.js';
import type {
  DirectorHumanMediaQcAction,
} from './human-media-qc.js';
import type {
  GenerationCostEstimate,
} from './generation-spend-gate.js';

export interface DirectorHumanMediaAcceptancePrior {
  acceptanceRate: number;
  effectiveSampleSize: number;
  sourceRef: string;
  derivedAt: string;
}

export interface DirectorHumanMediaAttemptEconomicsReceipt {
  schema: 'director.human-media-attempt-economics.v1';
  id: string;
  projectId: string;
  candidateId: string;
  engine: DirectorHumanMediaEngine;
  task: DirectorHumanMediaTaskKind;
  executionTier: DirectorHumanMediaExecutionTier;
  billingModel: DirectorHumanMediaBillingModel;
  attemptNumber: number;
  qcAction: DirectorHumanMediaQcAction;
  accepted: boolean;
  generationCostUsd: number;
  repairCostUsd: number;
  humanReviewMinutes: number;
  humanLaborRateUsdPerHour: number;
  pricingSourceRefs: readonly string[];
  evidenceIds: readonly string[];
  observedAt: string;
  authority: 'DIRECTOR_HUMAN_MEDIA_ATTEMPT_ECONOMICS';
}

export interface DirectorHumanMediaEconomicsCandidate {
  execution: DirectorHumanMediaExecutionCandidate;
  engine: DirectorHumanMediaEngine;
  task: DirectorHumanMediaTaskKind;
  currentGenerationEstimate: GenerationCostEstimate;
  acceptancePrior?: DirectorHumanMediaAcceptancePrior;
  attemptReceipts: readonly DirectorHumanMediaAttemptEconomicsReceipt[];
}

export interface DirectorHumanMediaAcceptedCostBreakdown {
  candidateId: string;
  observedAttempts: number;
  observedAcceptedOutputs: number;
  observedAcceptanceRate?: number;
  posteriorAcceptanceRate?: number;
  expectedAttemptsPerAcceptedOutput?: number;
  expectedRetriesPerAcceptedOutput?: number;
  currentGenerationCostUsd: number;
  observedAverageRepairCostPerAttemptUsd: number;
  observedAverageHumanCostPerAttemptUsd: number;
  expectedCostPerAttemptUsd?: number;
  expectedCostPerAcceptedOutputUsd?: number;
  realizedTotalCostUsd: number;
  realizedCostPerAcceptedOutputUsd?: number;
  pricingSourceRefs: readonly string[];
  evidenceIds: readonly string[];
  rankable: boolean;
  reasons: readonly string[];
  authority: 'DIRECTOR_HUMAN_MEDIA_ACCEPTED_COST';
}

export type DirectorHumanMediaEconomicOverrideMode =
  | 'never'
  | 'when-local-unviable'
  | 'always';

export interface DirectorHumanMediaEconomicRoutingPolicy {
  runtime: DirectorHumanMediaRuntimePolicy;
  economicOverrideMode: DirectorHumanMediaEconomicOverrideMode;
  maximumAcceptedCostUsd?: number;
  minimumObservedAttemptsForHistoryOnly: number;
}

export interface DirectorHumanMediaEconomicRankedCandidate {
  candidateId: string;
  executionTier: DirectorHumanMediaExecutionTier;
  cost: DirectorHumanMediaAcceptedCostBreakdown;
  admissible: boolean;
  reasons: readonly string[];
}

export interface DirectorHumanMediaEconomicRouteDecision {
  selectedCandidateId?: string;
  ranked: readonly DirectorHumanMediaEconomicRankedCandidate[];
  reasons: readonly string[];
  authority: 'DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER';
}

export const DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTING_POLICY: Readonly<DirectorHumanMediaEconomicRoutingPolicy> =
  Object.freeze({
    runtime: DIRECTOR_LOCAL_FIRST_HUMAN_MEDIA_POLICY,
    economicOverrideMode: 'when-local-unviable',
    minimumObservedAttemptsForHistoryOnly: 3,
  });

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function validIso(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validMoney(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function candidateAllowed(
  candidate: DirectorHumanMediaExecutionCandidate,
  policy: DirectorHumanMediaRuntimePolicy,
): boolean {
  if (!candidate.healthy || !candidate.commercialReady) return false;
  if (candidate.executionTier === 'gpu-burst' && !policy.allowGpuBurst) return false;
  if (candidate.executionTier === 'metered-external-api' && !policy.allowMeteredExternalApi) return false;
  if (candidate.executionTier === 'subscription-saas' && !policy.allowSubscriptionSaas) return false;
  if (candidate.billingModel === 'metered-api' && !policy.allowMeteredExternalApi) return false;
  if (candidate.billingModel === 'subscription' && !policy.allowSubscriptionSaas) return false;
  return true;
}

function validateEstimate(estimate: GenerationCostEstimate): readonly string[] {
  const reasons: string[] = [];
  if (!estimate.id.trim() || !estimate.projectId.trim()) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ESTIMATE_IDENTITY_REQUIRED');
  }
  if (!estimate.provider.trim() || !estimate.modelId.trim()) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ESTIMATE_PROVIDER_REQUIRED');
  }
  if (!estimate.pricingSourceRef.trim()) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_PRICING_SOURCE_REQUIRED');
  }
  if (!validMoney(estimate.quantity) || estimate.quantity <= 0) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ESTIMATE_QUANTITY_INVALID');
  }
  if (!validMoney(estimate.unitPriceUsd) || !validMoney(estimate.estimatedCostUsd)) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ESTIMATE_COST_INVALID');
  }
  const recomputed = estimate.quantity * estimate.unitPriceUsd;
  if (Number.isFinite(recomputed) && Math.abs(recomputed - estimate.estimatedCostUsd) > 0.01) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ESTIMATE_MISMATCH');
  }
  if (!validIso(estimate.derivedAt)) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ESTIMATE_TIME_INVALID');
  }
  return Object.freeze([...new Set(reasons)]);
}

function validatePrior(prior: DirectorHumanMediaAcceptancePrior | undefined): readonly string[] {
  if (!prior) return Object.freeze([]);
  const reasons: string[] = [];
  if (
    !Number.isFinite(prior.acceptanceRate) ||
    prior.acceptanceRate <= 0 ||
    prior.acceptanceRate > 1
  ) reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_PRIOR_RATE_INVALID');
  if (
    !Number.isFinite(prior.effectiveSampleSize) ||
    prior.effectiveSampleSize <= 0
  ) reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_PRIOR_STRENGTH_INVALID');
  if (!prior.sourceRef.trim()) reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_PRIOR_SOURCE_REQUIRED');
  if (!validIso(prior.derivedAt)) reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_PRIOR_TIME_INVALID');
  return Object.freeze([...new Set(reasons)]);
}

function validateAttempt(
  attempt: DirectorHumanMediaAttemptEconomicsReceipt,
  candidate: DirectorHumanMediaEconomicsCandidate,
): readonly string[] {
  const reasons: string[] = [];
  if (!attempt.id.trim() || !attempt.projectId.trim() || !attempt.candidateId.trim()) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_IDENTITY_REQUIRED');
  }
  if (attempt.candidateId !== candidate.execution.id) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_CANDIDATE_MISMATCH');
  }
  if (attempt.engine !== candidate.engine || attempt.task !== candidate.task) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_WORKLOAD_MISMATCH');
  }
  if (
    attempt.executionTier !== candidate.execution.executionTier ||
    attempt.billingModel !== candidate.execution.billingModel
  ) reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_RUNTIME_MISMATCH');
  if (!Number.isInteger(attempt.attemptNumber) || attempt.attemptNumber < 1) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_NUMBER_INVALID');
  }
  if (
    !validMoney(attempt.generationCostUsd) ||
    !validMoney(attempt.repairCostUsd) ||
    !validMoney(attempt.humanReviewMinutes) ||
    !validMoney(attempt.humanLaborRateUsdPerHour)
  ) reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_COST_INVALID');
  if (!attempt.pricingSourceRefs.length || !unique(attempt.pricingSourceRefs).length) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_PRICING_SOURCE_REQUIRED');
  }
  if (!attempt.evidenceIds.length || !unique(attempt.evidenceIds).length) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_EVIDENCE_REQUIRED');
  }
  if (!validIso(attempt.observedAt)) reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_TIME_INVALID');
  if (attempt.accepted !== (attempt.qcAction === 'accept')) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ACCEPTANCE_QC_MISMATCH');
  }
  return Object.freeze([...new Set(reasons)]);
}

function humanCost(attempt: DirectorHumanMediaAttemptEconomicsReceipt): number {
  return attempt.humanReviewMinutes / 60 * attempt.humanLaborRateUsdPerHour;
}

export function deriveDirectorHumanMediaAcceptedCost(
  candidate: DirectorHumanMediaEconomicsCandidate,
  minimumObservedAttemptsForHistoryOnly = 3,
): DirectorHumanMediaAcceptedCostBreakdown {
  const reasons = [
    ...validateEstimate(candidate.currentGenerationEstimate),
    ...validatePrior(candidate.acceptancePrior),
  ];
  if (
    !Number.isInteger(minimumObservedAttemptsForHistoryOnly) ||
    minimumObservedAttemptsForHistoryOnly < 1
  ) reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_HISTORY_MINIMUM_INVALID');
  if (candidate.currentGenerationEstimate.provider !== candidate.execution.id) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ESTIMATE_CANDIDATE_MISMATCH');
  }

  const attemptNumbers = new Set<number>();
  for (const attempt of candidate.attemptReceipts) {
    reasons.push(...validateAttempt(attempt, candidate));
    if (attemptNumbers.has(attempt.attemptNumber)) {
      reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_DUPLICATE');
    }
    attemptNumbers.add(attempt.attemptNumber);
  }

  const attempts = candidate.attemptReceipts.length;
  const accepted = candidate.attemptReceipts.filter((attempt) => attempt.accepted).length;
  const observedAcceptanceRate = attempts > 0 ? accepted / attempts : undefined;

  let posteriorAcceptanceRate: number | undefined;
  if (candidate.acceptancePrior && validatePrior(candidate.acceptancePrior).length === 0) {
    const prior = candidate.acceptancePrior;
    posteriorAcceptanceRate =
      (accepted + prior.acceptanceRate * prior.effectiveSampleSize) /
      (attempts + prior.effectiveSampleSize);
  } else if (attempts >= minimumObservedAttemptsForHistoryOnly) {
    posteriorAcceptanceRate = observedAcceptanceRate;
  } else {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ACCEPTANCE_EVIDENCE_INSUFFICIENT');
  }

  const totalRepair = candidate.attemptReceipts.reduce((sum, attempt) => sum + attempt.repairCostUsd, 0);
  const totalHuman = candidate.attemptReceipts.reduce((sum, attempt) => sum + humanCost(attempt), 0);
  const realizedGeneration = candidate.attemptReceipts.reduce((sum, attempt) => sum + attempt.generationCostUsd, 0);
  const realizedTotal = realizedGeneration + totalRepair + totalHuman;

  const averageRepair = attempts > 0 ? totalRepair / attempts : 0;
  const averageHuman = attempts > 0 ? totalHuman / attempts : 0;
  const expectedCostPerAttempt =
    validMoney(candidate.currentGenerationEstimate.estimatedCostUsd)
      ? candidate.currentGenerationEstimate.estimatedCostUsd + averageRepair + averageHuman
      : undefined;

  const posteriorValid =
    posteriorAcceptanceRate !== undefined &&
    Number.isFinite(posteriorAcceptanceRate) &&
    posteriorAcceptanceRate > 0 &&
    posteriorAcceptanceRate <= 1;
  if (posteriorAcceptanceRate !== undefined && !posteriorValid) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMICS_POSTERIOR_RATE_INVALID');
  }

  const expectedCostPerAcceptedOutputUsd =
    expectedCostPerAttempt !== undefined && posteriorValid
      ? expectedCostPerAttempt / posteriorAcceptanceRate!
      : undefined;
  const expectedAttemptsPerAcceptedOutput =
    posteriorValid ? 1 / posteriorAcceptanceRate! : undefined;
  const expectedRetriesPerAcceptedOutput =
    expectedAttemptsPerAcceptedOutput !== undefined
      ? Math.max(0, expectedAttemptsPerAcceptedOutput - 1)
      : undefined;
  const realizedCostPerAcceptedOutputUsd =
    accepted > 0 ? realizedTotal / accepted : undefined;

  const pricingSourceRefs = unique([
    candidate.currentGenerationEstimate.pricingSourceRef,
    ...(candidate.acceptancePrior ? [candidate.acceptancePrior.sourceRef] : []),
    ...candidate.attemptReceipts.flatMap((attempt) => attempt.pricingSourceRefs),
  ]);
  const evidenceIds = unique([
    `generation-cost-estimate:${candidate.currentGenerationEstimate.id}`,
    ...candidate.attemptReceipts.flatMap((attempt) => attempt.evidenceIds),
    ...candidate.attemptReceipts.map((attempt) => `human-media-attempt-economics:${attempt.id}`),
  ]);

  const blockingPrefixes = [
    'DIRECTOR_HUMAN_MEDIA_ECONOMICS_ESTIMATE_',
    'DIRECTOR_HUMAN_MEDIA_ECONOMICS_PRIOR_',
    'DIRECTOR_HUMAN_MEDIA_ECONOMICS_HISTORY_',
    'DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_',
    'DIRECTOR_HUMAN_MEDIA_ECONOMICS_ACCEPTANCE_QC_MISMATCH',
    'DIRECTOR_HUMAN_MEDIA_ECONOMICS_ACCEPTANCE_EVIDENCE_INSUFFICIENT',
    'DIRECTOR_HUMAN_MEDIA_ECONOMICS_POSTERIOR_RATE_INVALID',
    'DIRECTOR_HUMAN_MEDIA_ECONOMICS_PRICING_SOURCE_REQUIRED',
  ];
  const uniqueReasons = unique(reasons);
  const rankable =
    expectedCostPerAcceptedOutputUsd !== undefined &&
    Number.isFinite(expectedCostPerAcceptedOutputUsd) &&
    uniqueReasons.every((reason) => !blockingPrefixes.some((prefix) => reason.startsWith(prefix)));

  return Object.freeze({
    candidateId: candidate.execution.id,
    observedAttempts: attempts,
    observedAcceptedOutputs: accepted,
    ...(observedAcceptanceRate !== undefined ? { observedAcceptanceRate } : {}),
    ...(posteriorAcceptanceRate !== undefined ? { posteriorAcceptanceRate } : {}),
    ...(expectedAttemptsPerAcceptedOutput !== undefined ? { expectedAttemptsPerAcceptedOutput } : {}),
    ...(expectedRetriesPerAcceptedOutput !== undefined ? { expectedRetriesPerAcceptedOutput } : {}),
    currentGenerationCostUsd: candidate.currentGenerationEstimate.estimatedCostUsd,
    observedAverageRepairCostPerAttemptUsd: averageRepair,
    observedAverageHumanCostPerAttemptUsd: averageHuman,
    ...(expectedCostPerAttempt !== undefined ? { expectedCostPerAttemptUsd: expectedCostPerAttempt } : {}),
    ...(expectedCostPerAcceptedOutputUsd !== undefined
      ? { expectedCostPerAcceptedOutputUsd }
      : {}),
    realizedTotalCostUsd: realizedTotal,
    ...(realizedCostPerAcceptedOutputUsd !== undefined
      ? { realizedCostPerAcceptedOutputUsd }
      : {}),
    pricingSourceRefs: Object.freeze(pricingSourceRefs),
    evidenceIds: Object.freeze(evidenceIds),
    rankable,
    reasons: Object.freeze(uniqueReasons),
    authority: 'DIRECTOR_HUMAN_MEDIA_ACCEPTED_COST',
  });
}

function tierRank(tier: DirectorHumanMediaExecutionTier): number {
  switch (tier) {
    case 'local-homebase': return 0;
    case 'gpu-burst': return 1;
    case 'metered-external-api': return 2;
    case 'subscription-saas': return 3;
  }
}

function sortEconomics(
  a: DirectorHumanMediaEconomicRankedCandidate,
  b: DirectorHumanMediaEconomicRankedCandidate,
): number {
  const aCost = a.cost.expectedCostPerAcceptedOutputUsd ?? Number.POSITIVE_INFINITY;
  const bCost = b.cost.expectedCostPerAcceptedOutputUsd ?? Number.POSITIVE_INFINITY;
  return Number(b.admissible) - Number(a.admissible) ||
    aCost - bCost ||
    tierRank(a.executionTier) - tierRank(b.executionTier) ||
    a.candidateId.localeCompare(b.candidateId);
}

function isLocalViable(
  candidate: DirectorHumanMediaEconomicRankedCandidate,
  policy: DirectorHumanMediaEconomicRoutingPolicy,
): boolean {
  if (!candidate.admissible || candidate.executionTier !== 'local-homebase') return false;
  if (policy.maximumAcceptedCostUsd === undefined) return true;
  const cost = candidate.cost.expectedCostPerAcceptedOutputUsd;
  return cost !== undefined && cost <= policy.maximumAcceptedCostUsd;
}

export function routeDirectorHumanMediaByAcceptedCost(
  role: DirectorHumanMediaRole,
  candidates: readonly DirectorHumanMediaEconomicsCandidate[],
  policy: DirectorHumanMediaEconomicRoutingPolicy = DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTING_POLICY,
): DirectorHumanMediaEconomicRouteDecision {
  const routeReasons: string[] = [];
  if (
    !Number.isInteger(policy.minimumObservedAttemptsForHistoryOnly) ||
    policy.minimumObservedAttemptsForHistoryOnly < 1
  ) routeReasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER_HISTORY_MINIMUM_INVALID');
  if (
    policy.maximumAcceptedCostUsd !== undefined &&
    (!Number.isFinite(policy.maximumAcceptedCostUsd) || policy.maximumAcceptedCostUsd < 0)
  ) routeReasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER_MAX_COST_INVALID');

  const ranked = candidates.map((candidate): DirectorHumanMediaEconomicRankedCandidate => {
    const reasons: string[] = [];
    if (!candidate.execution.roles.includes(role)) {
      reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER_ROLE_MISMATCH');
    }
    if (!candidateAllowed(candidate.execution, policy.runtime)) {
      reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER_RUNTIME_NOT_ALLOWED');
    }
    const cost = deriveDirectorHumanMediaAcceptedCost(
      candidate,
      policy.minimumObservedAttemptsForHistoryOnly,
    );
    if (!cost.rankable) reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER_COST_UNRANKABLE');
    if (
      policy.maximumAcceptedCostUsd !== undefined &&
      cost.expectedCostPerAcceptedOutputUsd !== undefined &&
      cost.expectedCostPerAcceptedOutputUsd > policy.maximumAcceptedCostUsd
    ) reasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER_ACCEPTED_COST_OVER_BUDGET');

    return Object.freeze({
      candidateId: candidate.execution.id,
      executionTier: candidate.execution.executionTier,
      cost,
      admissible: reasons.length === 0,
      reasons: Object.freeze(unique(reasons)),
    });
  }).sort(sortEconomics);

  const admissible = ranked.filter((candidate) => candidate.admissible);
  let pool = admissible;
  if (policy.runtime.preferLocal && policy.economicOverrideMode !== 'always') {
    const local = admissible.filter((candidate) => candidate.executionTier === 'local-homebase');
    if (policy.economicOverrideMode === 'never' && local.length) {
      pool = local;
    } else if (
      policy.economicOverrideMode === 'when-local-unviable' &&
      local.some((candidate) => isLocalViable(candidate, policy))
    ) {
      pool = local.filter((candidate) => isLocalViable(candidate, policy));
    }
  }

  const selected = [...pool].sort(sortEconomics)[0];
  if (!selected) routeReasons.push('DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER_NO_ADMISSIBLE_CANDIDATE');

  return Object.freeze({
    ...(selected ? { selectedCandidateId: selected.candidateId } : {}),
    ranked: Object.freeze(ranked),
    reasons: Object.freeze(unique(routeReasons)),
    authority: 'DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER',
  });
}

export function summarizeDirectorHumanMediaAttemptCost(
  attempt: DirectorHumanMediaAttemptEconomicsReceipt,
): Readonly<{
  generationCostUsd:number;
  repairCostUsd:number;
  humanCostUsd:number;
  totalCostUsd:number;
}> {
  const humanCostUsd = humanCost(attempt);
  return Object.freeze({
    generationCostUsd: attempt.generationCostUsd,
    repairCostUsd: attempt.repairCostUsd,
    humanCostUsd,
    totalCostUsd: attempt.generationCostUsd + attempt.repairCostUsd + humanCostUsd,
  });
}
