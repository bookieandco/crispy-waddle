import type { DecisionAssessment, DecisionCase } from './decision-workflow-contracts.js';
import type {
  PredictionMarketSnapshot,
  PredictionOutcomeState,
  PredictionMarketResolution,
} from './prediction-market-reality.js';
import { brierScore } from './prediction-calibration-contracts.js';

export const PREDICTION_MARKET_INTELLIGENCE_SCHEMA_VERSION = 'MONEY-PREDICTION-02' as const;

export type PredictionMarketFactorKind =
  | 'MARKET_PROBABILITY'
  | 'INDEPENDENT_PROBABILITY'
  | 'SPREAD'
  | 'LIQUIDITY'
  | 'CALIBRATION'
  | 'EVENT'
  | 'RESOLUTION_RISK'
  | 'OTHER';

export type PredictionMarketFactor = Readonly<{
  factorId: string;
  kind: PredictionMarketFactorKind;
  outcomeId?: string;
  value: number;
  unit: string;
  informationCutoff: string;
  sourceSnapshotIds: readonly string[];
  evidenceRefs: readonly string[];
  methodologyVersion: string;
  provenanceHash: string;
}>;

export type IndependentProbabilityEstimate = Readonly<{
  estimateId: string;
  outcomeId: string;
  probability: number;
  modelId: string;
  modelVersion: string;
  issuedAt: string;
  availableAt: string;
  informationCutoff: string;
  calibrationStatus: 'CALIBRATED' | 'PROVISIONAL' | 'INSUFFICIENT_DATA' | 'UNKNOWN';
  evidenceRefs: readonly string[];
  evidenceSnapshotHash: string;
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type PredictionMarketResearchView = Readonly<{
  viewId: string;
  marketId: string;
  instrumentId: string;
  outcomeId: string;
  informationCutoff: string;
  marketMidpointProbability: number;
  independentProbability: number;
  divergence: number;
  spreadProbability: number;
  availableLiquidity: number | null;
  confidence: number;
  rationale: string;
  estimateId: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type PredictionMarketRiskAssessment = Readonly<{
  riskAssessmentId: string;
  marketId: string;
  instrumentId: string;
  outcomeId: string;
  informationCutoff: string;
  liquidityRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  resolutionRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  observedSpreadProbability: number;
  completeSetArbitrage: PredictionMarketSnapshot['completeSetArbitrage'];
  disputeWindowPresent: boolean;
  reasons: readonly string[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type PredictionMarketIntelligenceSnapshot = Readonly<{
  schemaVersion: typeof PREDICTION_MARKET_INTELLIGENCE_SCHEMA_VERSION;
  intelligenceId: string;
  marketId: string;
  instrumentId: string;
  outcomeId: string;
  informationCutoff: string;
  marketSnapshotId: string;
  estimate: IndependentProbabilityEstimate;
  factors: readonly PredictionMarketFactor[];
  view: PredictionMarketResearchView;
  risk: PredictionMarketRiskAssessment;
  decisionCase: DecisionCase;
  assessment: DecisionAssessment;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type PredictionMarketCalibrationResult = Readonly<{
  calibrationId: string;
  estimateId: string;
  resolutionId: string;
  outcomeId: string;
  resolvedOutcomeId?: string;
  outcome: 0 | 1;
  score: number;
  scoredAt: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  authority: 'LEARNING_ONLY';
}>;

function nonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function timestamp(value: string, code: string): number {
  nonEmpty(value, code);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

function probability(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(code);
}

function finite(value: number, code: string): void {
  if (!Number.isFinite(value)) throw new Error(code);
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function outcomeState(snapshot: PredictionMarketSnapshot, outcomeId: string): PredictionOutcomeState {
  const state = snapshot.outcomes.find((candidate) => candidate.outcomeId === outcomeId);
  if (!state) throw new Error('MONEY_PREDICTION_INTELLIGENCE_UNKNOWN_OUTCOME');
  return state;
}

function assertSnapshotAuthority(snapshot: PredictionMarketSnapshot): void {
  if (
    snapshot.researchAuthority !== 'INTELLIGENCE_ONLY' ||
    snapshot.executionAuthority !== 'NONE' ||
    snapshot.financialAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_PREDICTION_INTELLIGENCE_SNAPSHOT_AUTHORITY_FORBIDDEN');
  }
}

export function assertIndependentProbabilityEstimate(
  estimate: IndependentProbabilityEstimate,
  snapshot: PredictionMarketSnapshot,
): void {
  assertSnapshotAuthority(snapshot);
  nonEmpty(estimate.estimateId, 'MONEY_PREDICTION_ESTIMATE_ID_REQUIRED');
  nonEmpty(estimate.outcomeId, 'MONEY_PREDICTION_ESTIMATE_OUTCOME_REQUIRED');
  probability(estimate.probability, 'MONEY_PREDICTION_ESTIMATE_PROBABILITY_INVALID');
  nonEmpty(estimate.modelId, 'MONEY_PREDICTION_ESTIMATE_MODEL_REQUIRED');
  nonEmpty(estimate.modelVersion, 'MONEY_PREDICTION_ESTIMATE_MODEL_VERSION_REQUIRED');
  nonEmpty(estimate.evidenceSnapshotHash, 'MONEY_PREDICTION_ESTIMATE_EVIDENCE_HASH_REQUIRED');
  nonEmpty(estimate.provenanceHash, 'MONEY_PREDICTION_ESTIMATE_PROVENANCE_REQUIRED');
  if (!estimate.evidenceRefs.length) throw new Error('MONEY_PREDICTION_ESTIMATE_EVIDENCE_REQUIRED');
  if (estimate.financialAuthority !== 'NONE') throw new Error('MONEY_PREDICTION_ESTIMATE_AUTHORITY_FORBIDDEN');

  outcomeState(snapshot, estimate.outcomeId);
  const issued = timestamp(estimate.issuedAt, 'MONEY_PREDICTION_ESTIMATE_ISSUED_INVALID');
  const available = timestamp(estimate.availableAt, 'MONEY_PREDICTION_ESTIMATE_AVAILABLE_INVALID');
  const cutoff = timestamp(estimate.informationCutoff, 'MONEY_PREDICTION_ESTIMATE_CUTOFF_INVALID');
  const marketCutoff = timestamp(snapshot.informationCutoff, 'MONEY_PREDICTION_SNAPSHOT_CUTOFF_INVALID');
  if (available < issued) throw new Error('MONEY_PREDICTION_ESTIMATE_AVAILABLE_BEFORE_ISSUED');
  if (cutoff > marketCutoff || available > marketCutoff) {
    throw new Error('MONEY_PREDICTION_ESTIMATE_FUTURE_INFORMATION');
  }
}

export function buildPredictionMarketFactors(input: Readonly<{
  snapshot: PredictionMarketSnapshot;
  outcomeId: string;
  independentEstimate: IndependentProbabilityEstimate;
  additionalFactors?: readonly PredictionMarketFactor[];
}>): readonly PredictionMarketFactor[] {
  assertIndependentProbabilityEstimate(input.independentEstimate, input.snapshot);
  if (input.independentEstimate.outcomeId !== input.outcomeId) {
    throw new Error('MONEY_PREDICTION_FACTOR_ESTIMATE_OUTCOME_MISMATCH');
  }
  const state = outcomeState(input.snapshot, input.outcomeId);

  const canonical: PredictionMarketFactor[] = [
    Object.freeze({
      factorId: `${input.snapshot.snapshotId}:${input.outcomeId}:market-probability`,
      kind: 'MARKET_PROBABILITY',
      outcomeId: input.outcomeId,
      value: state.midpointProbability,
      unit: 'PROBABILITY',
      informationCutoff: input.snapshot.informationCutoff,
      sourceSnapshotIds: Object.freeze([input.snapshot.snapshotId]),
      evidenceRefs: Object.freeze([...state.evidenceRefs]),
      methodologyVersion: 'prediction-market-midpoint-v1',
      provenanceHash: input.snapshot.snapshotHash,
    }),
    Object.freeze({
      factorId: `${input.snapshot.snapshotId}:${input.outcomeId}:independent-probability`,
      kind: 'INDEPENDENT_PROBABILITY',
      outcomeId: input.outcomeId,
      value: input.independentEstimate.probability,
      unit: 'PROBABILITY',
      informationCutoff: input.independentEstimate.informationCutoff,
      sourceSnapshotIds: Object.freeze([input.snapshot.snapshotId]),
      evidenceRefs: Object.freeze([...input.independentEstimate.evidenceRefs]),
      methodologyVersion: `${input.independentEstimate.modelId}@${input.independentEstimate.modelVersion}`,
      provenanceHash: input.independentEstimate.provenanceHash,
    }),
    Object.freeze({
      factorId: `${input.snapshot.snapshotId}:${input.outcomeId}:spread`,
      kind: 'SPREAD',
      outcomeId: input.outcomeId,
      value: state.spreadProbability,
      unit: 'PROBABILITY',
      informationCutoff: input.snapshot.informationCutoff,
      sourceSnapshotIds: Object.freeze([input.snapshot.snapshotId]),
      evidenceRefs: Object.freeze([...state.evidenceRefs]),
      methodologyVersion: 'prediction-market-spread-v1',
      provenanceHash: input.snapshot.snapshotHash,
    }),
  ];

  for (const factor of input.additionalFactors ?? []) {
    nonEmpty(factor.factorId, 'MONEY_PREDICTION_FACTOR_ID_REQUIRED');
    nonEmpty(factor.unit, 'MONEY_PREDICTION_FACTOR_UNIT_REQUIRED');
    finite(factor.value, 'MONEY_PREDICTION_FACTOR_VALUE_INVALID');
    nonEmpty(factor.methodologyVersion, 'MONEY_PREDICTION_FACTOR_METHODOLOGY_REQUIRED');
    nonEmpty(factor.provenanceHash, 'MONEY_PREDICTION_FACTOR_PROVENANCE_REQUIRED');
    if (!factor.sourceSnapshotIds.includes(input.snapshot.snapshotId)) {
      throw new Error('MONEY_PREDICTION_FACTOR_SNAPSHOT_LINEAGE_INVALID');
    }
    if (!factor.evidenceRefs.length) throw new Error('MONEY_PREDICTION_FACTOR_EVIDENCE_REQUIRED');
    if (
      timestamp(factor.informationCutoff, 'MONEY_PREDICTION_FACTOR_CUTOFF_INVALID') >
      timestamp(input.snapshot.informationCutoff, 'MONEY_PREDICTION_SNAPSHOT_CUTOFF_INVALID')
    ) {
      throw new Error('MONEY_PREDICTION_FACTOR_FUTURE_INFORMATION');
    }
    if (factor.outcomeId !== undefined && factor.outcomeId !== input.outcomeId) {
      throw new Error('MONEY_PREDICTION_FACTOR_OUTCOME_MISMATCH');
    }
  }

  const all = [...canonical, ...(input.additionalFactors ?? [])];
  const ids = new Set<string>();
  for (const factor of all) {
    if (ids.has(factor.factorId)) throw new Error('MONEY_PREDICTION_FACTOR_DUPLICATE');
    ids.add(factor.factorId);
  }
  return Object.freeze(all);
}

export function buildPredictionMarketResearchView(input: Readonly<{
  viewId: string;
  snapshot: PredictionMarketSnapshot;
  estimate: IndependentProbabilityEstimate;
  confidence: number;
  rationale: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): PredictionMarketResearchView {
  assertIndependentProbabilityEstimate(input.estimate, input.snapshot);
  const state = outcomeState(input.snapshot, input.estimate.outcomeId);
  nonEmpty(input.viewId, 'MONEY_PREDICTION_VIEW_ID_REQUIRED');
  probability(input.confidence, 'MONEY_PREDICTION_VIEW_CONFIDENCE_INVALID');
  nonEmpty(input.rationale, 'MONEY_PREDICTION_VIEW_RATIONALE_REQUIRED');
  nonEmpty(input.provenanceHash, 'MONEY_PREDICTION_VIEW_PROVENANCE_REQUIRED');

  const availableLiquidity =
    state.bidSize === undefined && state.askSize === undefined
      ? null
      : (state.bidSize ?? 0) + (state.askSize ?? 0);

  return Object.freeze({
    viewId: input.viewId,
    marketId: input.snapshot.marketId,
    instrumentId: input.snapshot.instrumentId,
    outcomeId: input.estimate.outcomeId,
    informationCutoff: input.snapshot.informationCutoff,
    marketMidpointProbability: state.midpointProbability,
    independentProbability: input.estimate.probability,
    divergence:
      Math.round((input.estimate.probability - state.midpointProbability) * 1_000_000_000) /
      1_000_000_000,
    spreadProbability: state.spreadProbability,
    availableLiquidity,
    confidence: input.confidence,
    rationale: input.rationale,
    estimateId: input.estimate.estimateId,
    evidenceRefs: unique([
      ...state.evidenceRefs,
      ...input.estimate.evidenceRefs,
      ...input.evidenceRefs,
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildPredictionMarketRiskAssessment(input: Readonly<{
  riskAssessmentId: string;
  snapshot: PredictionMarketSnapshot;
  outcomeId: string;
  liquidityRisk: PredictionMarketRiskAssessment['liquidityRisk'];
  resolutionRisk: PredictionMarketRiskAssessment['resolutionRisk'];
  reasons: readonly string[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): PredictionMarketRiskAssessment {
  assertSnapshotAuthority(input.snapshot);
  const state = outcomeState(input.snapshot, input.outcomeId);
  nonEmpty(input.riskAssessmentId, 'MONEY_PREDICTION_RISK_ID_REQUIRED');
  nonEmpty(input.provenanceHash, 'MONEY_PREDICTION_RISK_PROVENANCE_REQUIRED');
  if (!input.reasons.length) throw new Error('MONEY_PREDICTION_RISK_REASONS_REQUIRED');

  return Object.freeze({
    riskAssessmentId: input.riskAssessmentId,
    marketId: input.snapshot.marketId,
    instrumentId: input.snapshot.instrumentId,
    outcomeId: input.outcomeId,
    informationCutoff: input.snapshot.informationCutoff,
    liquidityRisk: input.liquidityRisk,
    resolutionRisk: input.resolutionRisk,
    observedSpreadProbability: state.spreadProbability,
    completeSetArbitrage: input.snapshot.completeSetArbitrage,
    disputeWindowPresent: input.snapshot.resolution.disputeWindowEndsAt !== undefined,
    reasons: Object.freeze([...input.reasons]),
    evidenceRefs: unique([
      ...input.snapshot.evidenceRefs,
      ...state.evidenceRefs,
      ...input.evidenceRefs,
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildPredictionMarketIntelligenceSnapshot(input: Readonly<{
  intelligenceId: string;
  accountId: string;
  requestedBy: string;
  createdAt: string;
  snapshot: PredictionMarketSnapshot;
  estimate: IndependentProbabilityEstimate;
  factors: readonly PredictionMarketFactor[];
  view: PredictionMarketResearchView;
  risk: PredictionMarketRiskAssessment;
  provenanceHash: string;
}>): PredictionMarketIntelligenceSnapshot {
  assertSnapshotAuthority(input.snapshot);
  assertIndependentProbabilityEstimate(input.estimate, input.snapshot);
  nonEmpty(input.intelligenceId, 'MONEY_PREDICTION_INTELLIGENCE_ID_REQUIRED');
  nonEmpty(input.accountId, 'MONEY_PREDICTION_INTELLIGENCE_ACCOUNT_REQUIRED');
  nonEmpty(input.requestedBy, 'MONEY_PREDICTION_INTELLIGENCE_REQUESTER_REQUIRED');
  nonEmpty(input.provenanceHash, 'MONEY_PREDICTION_INTELLIGENCE_PROVENANCE_REQUIRED');

  if (
    timestamp(input.createdAt, 'MONEY_PREDICTION_INTELLIGENCE_CREATED_INVALID') <
    timestamp(input.snapshot.informationCutoff, 'MONEY_PREDICTION_SNAPSHOT_CUTOFF_INVALID')
  ) {
    throw new Error('MONEY_PREDICTION_INTELLIGENCE_CREATED_BEFORE_CUTOFF');
  }
  if (
    input.view.financialAuthority !== 'NONE' ||
    input.risk.financialAuthority !== 'NONE' ||
    input.estimate.financialAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_PREDICTION_INTELLIGENCE_AUTHORITY_FORBIDDEN');
  }
  if (
    input.view.marketId !== input.snapshot.marketId ||
    input.risk.marketId !== input.snapshot.marketId ||
    input.view.outcomeId !== input.estimate.outcomeId ||
    input.risk.outcomeId !== input.estimate.outcomeId
  ) {
    throw new Error('MONEY_PREDICTION_INTELLIGENCE_LINEAGE_MISMATCH');
  }
  if (input.factors.length < 3) throw new Error('MONEY_PREDICTION_INTELLIGENCE_FACTORS_INSUFFICIENT');
  for (const factor of input.factors) {
    if (!factor.sourceSnapshotIds.includes(input.snapshot.snapshotId)) {
      throw new Error('MONEY_PREDICTION_INTELLIGENCE_FACTOR_LINEAGE_INVALID');
    }
  }

  const decisionCase: DecisionCase = Object.freeze({
    caseId: `prediction-market:${input.intelligenceId}`,
    accountId: input.accountId,
    subjectId: `${input.snapshot.marketId}:${input.estimate.outcomeId}`,
    requestedBy: input.requestedBy,
    informationCutoff: input.snapshot.informationCutoff,
    createdAt: input.createdAt,
    status: 'RESEARCH_ONLY',
    provenanceHash: input.provenanceHash,
  });

  const assessment: DecisionAssessment = Object.freeze({
    caseId: decisionCase.caseId,
    evidenceStatus: 'DERIVED',
    freshnessStatus: 'POINT_IN_TIME_BOUND',
    riskStatus: 'ASSESSED',
    stressStatus: 'NOT_PROVIDED',
    simulationStatus: 'NOT_RUN',
    liquidityStatus: input.risk.liquidityRisk,
    calibrationStatus: input.estimate.calibrationStatus,
    authorityStatus: 'MISSING',
    disposition: 'RESEARCH_ONLY',
  });

  return Object.freeze({
    schemaVersion: PREDICTION_MARKET_INTELLIGENCE_SCHEMA_VERSION,
    intelligenceId: input.intelligenceId,
    marketId: input.snapshot.marketId,
    instrumentId: input.snapshot.instrumentId,
    outcomeId: input.estimate.outcomeId,
    informationCutoff: input.snapshot.informationCutoff,
    marketSnapshotId: input.snapshot.snapshotId,
    estimate: input.estimate,
    factors: Object.freeze([...input.factors]),
    view: input.view,
    risk: input.risk,
    decisionCase,
    assessment,
    evidenceRefs: unique([
      ...input.snapshot.evidenceRefs,
      ...input.estimate.evidenceRefs,
      ...input.factors.flatMap((factor) => factor.evidenceRefs),
      ...input.view.evidenceRefs,
      ...input.risk.evidenceRefs,
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function scorePredictionMarketEstimate(input: Readonly<{
  calibrationId: string;
  estimate: IndependentProbabilityEstimate;
  resolution: PredictionMarketResolution;
  scoredAt: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): PredictionMarketCalibrationResult {
  nonEmpty(input.calibrationId, 'MONEY_PREDICTION_CALIBRATION_ID_REQUIRED');
  nonEmpty(input.provenanceHash, 'MONEY_PREDICTION_CALIBRATION_PROVENANCE_REQUIRED');
  if (input.resolution.status !== 'FINAL' || input.resolution.outcomeId === undefined) {
    throw new Error('MONEY_PREDICTION_CALIBRATION_FINAL_RESOLUTION_REQUIRED');
  }
  if (
    timestamp(input.scoredAt, 'MONEY_PREDICTION_CALIBRATION_SCORED_AT_INVALID') <
    timestamp(input.resolution.availableAt, 'MONEY_PREDICTION_CALIBRATION_RESOLUTION_AVAILABLE_INVALID')
  ) {
    throw new Error('MONEY_PREDICTION_CALIBRATION_BEFORE_RESOLUTION_AVAILABLE');
  }
  const outcome: 0 | 1 = input.resolution.outcomeId === input.estimate.outcomeId ? 1 : 0;
  return Object.freeze({
    calibrationId: input.calibrationId,
    estimateId: input.estimate.estimateId,
    resolutionId: input.resolution.resolutionId,
    outcomeId: input.estimate.outcomeId,
    resolvedOutcomeId: input.resolution.outcomeId,
    outcome,
    score: brierScore(input.estimate.probability, outcome),
    scoredAt: input.scoredAt,
    evidenceRefs: unique([
      ...input.estimate.evidenceRefs,
      ...input.resolution.evidenceRefs,
      ...input.evidenceRefs,
    ]),
    provenanceHash: input.provenanceHash,
    authority: 'LEARNING_ONLY',
  });
}
