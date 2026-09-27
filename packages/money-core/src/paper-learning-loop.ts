import { createHash } from 'node:crypto';
import {
  assessStrategyForAutonomousReview,
  calibrateAutonomousStrategy,
  learnFromPaperStrategy,
  type AutonomousLearningDomain,
  type StrategyCalibration,
  type StrategyLearningRecord,
  type StrategyPromotionAssessment,
} from './autonomous-strategy-learning.js';
import type { PaperStrategyResult } from './paper-strategy-result.js';

export const PAPER_LEARNING_LOOP_SCHEMA_VERSION = 'MONEY-PAPER-LOOP-01' as const;

export type PaperAutopilotMode =
  | 'OFF'
  | 'OBSERVE'
  | 'ADVISE'
  | 'PAPER_AUTO_REDUCED'
  | 'PAPER_AUTO'
  | 'HALT';

export type PaperDecisionAction = 'PAPER_TRADE' | 'NO_TRADE';

export type PaperDecisionObservation = Readonly<{
  schemaVersion: typeof PAPER_LEARNING_LOOP_SCHEMA_VERSION;
  decisionId: string;
  paperRunId: string;
  accountId: string;
  instrumentId: string;
  strategyId: string;
  scenarioId: string;
  action: PaperDecisionAction;
  side?: 'BUY' | 'SELL';
  signal: 'LONG_ENTRY' | 'EXIT' | 'HOLD' | 'OTHER';
  reasonCodes: readonly string[];
  informationCutoff: string;
  createdAt: string;
  evidenceIds: readonly string[];
  authority: 'DECISION_RECORD_ONLY';
  canAuthorizeLive: false;
}>;

export type PaperDecisionResolution = Readonly<{
  resolutionId: string;
  decisionId: string;
  resolvedAt: string;
  realizedReturnBps: number;
  maxFavorableExcursionBps: number;
  maxAdverseExcursionBps: number;
  evidenceIds: readonly string[];
  authority: 'LEARNING_ONLY';
  canAuthorizeLive: false;
}>;

export type PaperDecisionLearningRecord = Readonly<{
  learningId: string;
  decisionId: string;
  strategyId: string;
  scenarioId: string;
  instrumentId: string;
  action: PaperDecisionAction;
  realizedReturnBps: number;
  decisionQualityScore: number;
  avoidedLossBps: number;
  missedGainBps: number;
  evidenceIds: readonly string[];
  evaluatedAt: string;
  authority: 'LEARNING_ONLY';
  canAuthorizeLive: false;
}>;

export type PaperAutopilotEvaluationInput = Readonly<{
  mode: PaperAutopilotMode;
  accountEnvironment: 'PAPER' | 'LIVE';
  signal: PaperDecisionObservation['signal'];
  mimsStatus: 'PASS' | 'REVIEW' | 'FAIL';
  hardRiskStatus: 'PASS' | 'REVIEW' | 'FAIL';
  behavioralRiskStatus: 'PASS' | 'REVIEW' | 'HALT';
  providerHealth: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  unresolvedExecutionCount: number;
  calibration?: StrategyCalibration;
}>;

export type PaperAutopilotEvaluation = Readonly<{
  mode: PaperAutopilotMode;
  disposition:
    | 'HALT'
    | 'OBSERVE_ONLY'
    | 'ADVISE_ONLY'
    | 'NO_TRADE'
    | 'PAPER_TRADE_ELIGIBLE';
  reasonCodes: readonly string[];
  notionalMultiplierBps: number;
  authority: 'PAPER_ONLY';
  canAuthorizeLive: false;
}>;

export type ClosedPaperLearningUpdate = Readonly<{
  learningRecord: StrategyLearningRecord;
  calibration: StrategyCalibration;
  review: StrategyPromotionAssessment;
  authority: 'LEARNING_ONLY';
  canAuthorizeLive: false;
}>;

const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function assertTimestamp(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

function assertBps(value: number, code: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) throw new Error(code);
}

export function createPaperDecision(
  input: Omit<
    PaperDecisionObservation,
    'schemaVersion' | 'authority' | 'canAuthorizeLive'
  >,
): PaperDecisionObservation {
  if (
    !input.decisionId.trim() ||
    !input.paperRunId.trim() ||
    !input.accountId.trim() ||
    !input.instrumentId.trim() ||
    !input.strategyId.trim() ||
    !input.scenarioId.trim()
  ) {
    throw new Error('MONEY_PAPER_LOOP_DECISION_IDENTITY_REQUIRED');
  }
  const cutoff = assertTimestamp(
    input.informationCutoff,
    'MONEY_PAPER_LOOP_DECISION_CUTOFF_INVALID',
  );
  const created = assertTimestamp(
    input.createdAt,
    'MONEY_PAPER_LOOP_DECISION_CREATED_AT_INVALID',
  );
  if (created < cutoff) throw new Error('MONEY_PAPER_LOOP_DECISION_BEFORE_CUTOFF');
  if (!input.evidenceIds.length || !input.reasonCodes.length) {
    throw new Error('MONEY_PAPER_LOOP_DECISION_PROVENANCE_REQUIRED');
  }
  if (input.action === 'PAPER_TRADE' && !input.side) {
    throw new Error('MONEY_PAPER_LOOP_DECISION_SIDE_REQUIRED');
  }
  if (input.signal === 'HOLD' && input.action !== 'NO_TRADE') {
    throw new Error('MONEY_PAPER_LOOP_HOLD_MUST_BE_NO_TRADE');
  }

  return Object.freeze({
    ...input,
    reasonCodes: Object.freeze([...input.reasonCodes]),
    evidenceIds: Object.freeze([...input.evidenceIds]),
    schemaVersion: PAPER_LEARNING_LOOP_SCHEMA_VERSION,
    authority: 'DECISION_RECORD_ONLY',
    canAuthorizeLive: false,
  });
}

export function resolvePaperDecision(
  decision: PaperDecisionObservation,
  input: Readonly<{
    resolvedAt: string;
    realizedReturnBps: number;
    maxFavorableExcursionBps: number;
    maxAdverseExcursionBps: number;
    evidenceIds: readonly string[];
  }>,
): PaperDecisionResolution {
  const resolved = assertTimestamp(
    input.resolvedAt,
    'MONEY_PAPER_LOOP_RESOLUTION_TIME_INVALID',
  );
  const created = assertTimestamp(
    decision.createdAt,
    'MONEY_PAPER_LOOP_DECISION_CREATED_AT_INVALID',
  );
  if (resolved <= created) throw new Error('MONEY_PAPER_LOOP_RESOLUTION_TOO_EARLY');
  for (const [value, code] of [
    [input.realizedReturnBps, 'MONEY_PAPER_LOOP_REALIZED_RETURN_INVALID'],
    [input.maxFavorableExcursionBps, 'MONEY_PAPER_LOOP_MFE_INVALID'],
    [input.maxAdverseExcursionBps, 'MONEY_PAPER_LOOP_MAE_INVALID'],
  ] as const) {
    assertBps(value, code);
  }
  if (!input.evidenceIds.length) {
    throw new Error('MONEY_PAPER_LOOP_RESOLUTION_EVIDENCE_REQUIRED');
  }

  const resolutionId =
    'paper-decision-resolution:' +
    hash({
      decisionId: decision.decisionId,
      resolvedAt: input.resolvedAt,
      realizedReturnBps: input.realizedReturnBps,
      evidenceIds: [...input.evidenceIds].sort(),
    });

  return Object.freeze({
    resolutionId,
    decisionId: decision.decisionId,
    resolvedAt: input.resolvedAt,
    realizedReturnBps: input.realizedReturnBps,
    maxFavorableExcursionBps: input.maxFavorableExcursionBps,
    maxAdverseExcursionBps: input.maxAdverseExcursionBps,
    evidenceIds: Object.freeze([
      ...new Set([...decision.evidenceIds, ...input.evidenceIds]),
    ]),
    authority: 'LEARNING_ONLY',
    canAuthorizeLive: false,
  });
}

export function learnFromPaperDecision(
  decision: PaperDecisionObservation,
  resolution: PaperDecisionResolution,
): PaperDecisionLearningRecord {
  if (resolution.decisionId !== decision.decisionId) {
    throw new Error('MONEY_PAPER_LOOP_RESOLUTION_DECISION_MISMATCH');
  }

  const realized = resolution.realizedReturnBps;
  const avoidedLossBps =
    decision.action === 'NO_TRADE' ? Math.max(0, -realized) : 0;
  const missedGainBps =
    decision.action === 'NO_TRADE' ? Math.max(0, realized) : 0;

  const signedQuality =
    decision.action === 'PAPER_TRADE' ? realized : -realized;
  const decisionQualityScore = Math.max(
    -1,
    Math.min(1, signedQuality / 1000),
  );

  return Object.freeze({
    learningId:
      'paper-decision-learning:' +
      hash({
        decisionId: decision.decisionId,
        resolutionId: resolution.resolutionId,
      }),
    decisionId: decision.decisionId,
    strategyId: decision.strategyId,
    scenarioId: decision.scenarioId,
    instrumentId: decision.instrumentId,
    action: decision.action,
    realizedReturnBps: realized,
    decisionQualityScore,
    avoidedLossBps,
    missedGainBps,
    evidenceIds: Object.freeze([
      ...new Set([...decision.evidenceIds, ...resolution.evidenceIds]),
    ]),
    evaluatedAt: resolution.resolvedAt,
    authority: 'LEARNING_ONLY',
    canAuthorizeLive: false,
  });
}

export function evaluatePaperAutopilot(
  input: PaperAutopilotEvaluationInput,
): PaperAutopilotEvaluation {
  if (!Number.isInteger(input.unresolvedExecutionCount) || input.unresolvedExecutionCount < 0) {
    throw new Error('MONEY_PAPER_LOOP_UNRESOLVED_EXECUTIONS_INVALID');
  }

  const reasons: string[] = [];

  if (input.accountEnvironment !== 'PAPER') reasons.push('PAPER_ENVIRONMENT_REQUIRED');
  if (input.mode === 'HALT' || input.mode === 'OFF') reasons.push('AUTOPILOT_NOT_ACTIVE');
  if (input.providerHealth === 'DOWN') reasons.push('PROVIDER_DOWN');
  if (input.unresolvedExecutionCount > 0) reasons.push('UNRESOLVED_EXECUTION');
  if (input.mimsStatus === 'FAIL') reasons.push('MIMS_FAILED');
  if (input.hardRiskStatus === 'FAIL') reasons.push('HARD_RISK_FAILED');
  if (input.behavioralRiskStatus === 'HALT') reasons.push('BEHAVIORAL_RISK_HALT');

  if (reasons.length) {
    return Object.freeze({
      mode: input.mode,
      disposition: 'HALT',
      reasonCodes: Object.freeze(reasons),
      notionalMultiplierBps: 0,
      authority: 'PAPER_ONLY',
      canAuthorizeLive: false,
    });
  }

  if (input.mode === 'OBSERVE') {
    return Object.freeze({
      mode: input.mode,
      disposition: 'OBSERVE_ONLY',
      reasonCodes: Object.freeze(['OBSERVE_MODE']),
      notionalMultiplierBps: 0,
      authority: 'PAPER_ONLY',
      canAuthorizeLive: false,
    });
  }

  if (input.mode === 'ADVISE') {
    return Object.freeze({
      mode: input.mode,
      disposition: 'ADVISE_ONLY',
      reasonCodes: Object.freeze(['ADVISE_MODE']),
      notionalMultiplierBps: 0,
      authority: 'PAPER_ONLY',
      canAuthorizeLive: false,
    });
  }

  if (input.signal === 'HOLD') {
    return Object.freeze({
      mode: input.mode,
      disposition: 'NO_TRADE',
      reasonCodes: Object.freeze(['NO_SIGNAL']),
      notionalMultiplierBps: 0,
      authority: 'PAPER_ONLY',
      canAuthorizeLive: false,
    });
  }

  if (
    input.mimsStatus === 'REVIEW' ||
    input.hardRiskStatus === 'REVIEW' ||
    input.behavioralRiskStatus === 'REVIEW' ||
    input.providerHealth === 'DEGRADED'
  ) {
    return Object.freeze({
      mode: input.mode,
      disposition: 'NO_TRADE',
      reasonCodes: Object.freeze(['REVIEW_REQUIRED']),
      notionalMultiplierBps: 0,
      authority: 'PAPER_ONLY',
      canAuthorizeLive: false,
    });
  }

  if (
    input.signal === 'EXIT' &&
    (input.mode === 'PAPER_AUTO' || input.mode === 'PAPER_AUTO_REDUCED')
  ) {
    return Object.freeze({
      mode: input.mode,
      disposition: 'PAPER_TRADE_ELIGIBLE',
      reasonCodes: Object.freeze(['RISK_REDUCING_EXIT']),
      notionalMultiplierBps: 10_000,
      authority: 'PAPER_ONLY',
      canAuthorizeLive: false,
    });
  }

  const calibrationStatus = input.calibration?.status ?? 'INSUFFICIENT_EVIDENCE';

  if (input.mode === 'PAPER_AUTO' && calibrationStatus !== 'SIMULATION_SUPPORTED') {
    return Object.freeze({
      mode: input.mode,
      disposition: 'NO_TRADE',
      reasonCodes: Object.freeze(['PAPER_AUTO_REQUIRES_SUPPORTED_CALIBRATION']),
      notionalMultiplierBps: 0,
      authority: 'PAPER_ONLY',
      canAuthorizeLive: false,
    });
  }

  const notionalMultiplierBps =
    input.mode === 'PAPER_AUTO_REDUCED'
      ? calibrationStatus === 'SIMULATION_SUPPORTED'
        ? 5000
        : 2500
      : 10_000;

  return Object.freeze({
    mode: input.mode,
    disposition: 'PAPER_TRADE_ELIGIBLE',
    reasonCodes: Object.freeze([
      input.mode === 'PAPER_AUTO_REDUCED'
        ? 'REDUCED_PAPER_SIZE'
        : 'PAPER_AUTO_SUPPORTED',
    ]),
    notionalMultiplierBps,
    authority: 'PAPER_ONLY',
    canAuthorizeLive: false,
  });
}

export function learnClosedPaperRun(input: Readonly<{
  domain: AutonomousLearningDomain;
  strategyId: string;
  scenarioId: string;
  result: PaperStrategyResult;
  priorRecords: readonly StrategyLearningRecord[];
  calibratedAt: string;
  minimumSamples?: number;
  reviewCriteria: Readonly<{
    minSamples: number;
    minMeanReturnBps: number;
    minFillRateBps: number;
    maxDownsideRateBps: number;
    maxAbsSlippageBps: number;
  }>;
}>): ClosedPaperLearningUpdate {
  const learningRecord = learnFromPaperStrategy({
    domain: input.domain,
    strategyId: input.strategyId,
    scenarioId: input.scenarioId,
    result: input.result,
  });
  const records = Object.freeze([...input.priorRecords, learningRecord]);
  const calibration = calibrateAutonomousStrategy({
    domain: input.domain,
    strategyId: input.strategyId,
    records,
    calibratedAt: input.calibratedAt,
    minimumSamples: input.minimumSamples,
  });
  const review = assessStrategyForAutonomousReview({
    calibration,
    ...input.reviewCriteria,
  });

  return Object.freeze({
    learningRecord,
    calibration,
    review,
    authority: 'LEARNING_ONLY',
    canAuthorizeLive: false,
  });
}
