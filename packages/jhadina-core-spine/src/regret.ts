import type { EvidenceRef } from './types.js';

export type RegretSubjectType = 'prediction' | 'recommendation' | 'decision' | 'action' | 'process';
export type RegretSeverity = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
export type RegretAvoidability = 'unknown' | 'low' | 'medium' | 'high';
export type RegretStatus = 'proposed' | 'verified' | 'learned' | 'rejected' | 'superseded';
export type LearningType = 'knowledge' | 'reasoning' | 'process' | 'policy';
export type CounterfactualType = 'information' | 'reasoning' | 'decision' | 'process';

export interface RegretRecord {
  readonly regretId: string;
  readonly subjectType: RegretSubjectType;
  readonly subjectId: string;
  readonly createdAt: string;
  readonly originalBelief: string;
  readonly expectedOutcome: string;
  readonly actualOutcome: string;
  readonly outcomeEvidence: readonly EvidenceRef[];
  readonly discrepancy: string;
  readonly severity: RegretSeverity;
  readonly avoidability: RegretAvoidability;
  readonly rootCause?: string;
  readonly counterfactualId?: string;
  readonly learningProposalId?: string;
  readonly recurrenceCount: number;
  readonly status: RegretStatus;
}

export interface Counterfactual {
  readonly counterfactualId: string;
  readonly regretId: string;
  readonly type: CounterfactualType;
  readonly alternative: string;
  readonly requiredKnowledge?: string;
  readonly expectedEffect: string;
  readonly evidence: readonly EvidenceRef[];
  readonly preventability: RegretAvoidability;
  readonly confidence: number;
}

export interface LearningProposal {
  readonly proposalId: string;
  readonly sourceRegrets: readonly string[];
  readonly sourceCounterfactuals: readonly string[];
  readonly learningType: LearningType;
  readonly observedFailure: readonly EvidenceRef[];
  readonly proposedLearning: string;
  readonly supportingEvidence: readonly EvidenceRef[];
  readonly contradictingEvidence: readonly EvidenceRef[];
  readonly scope: { readonly domain: string; readonly conditions: readonly string[] };
  readonly preventability: RegretAvoidability;
  readonly status: 'proposed' | 'challenged' | 'approved' | 'rejected' | 'superseded';
}

export interface RegretCalibration {
  readonly predictionId: string;
  readonly predictedRegret: string;
  readonly anticipated: boolean;
  readonly occurred: boolean;
  readonly preventionHelped: boolean | null;
  readonly falsePositive: boolean;
  readonly falseNegative: boolean;
  readonly calibrationDelta: number;
}

export interface RegretPattern {
  readonly patternKey: string;
  readonly regretIds: readonly string[];
  readonly recurrence: number;
  readonly severityWeight: number;
  readonly preventabilityWeight: number;
  readonly pressure: number;
}

const severityWeight: Record<RegretSeverity, number> = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4, R5: 5 };
const avoidabilityWeight: Record<RegretAvoidability, number> = { unknown: 0, low: 0.25, medium: 0.5, high: 1 };

export function createRegretRecord(input: Omit<RegretRecord, 'status'> & { status?: RegretStatus }): RegretRecord {
  if (input.outcomeEvidence.length === 0) throw new Error('REGRET requires outcome evidence');
  return Object.freeze({ ...input, status: input.status ?? 'verified', outcomeEvidence: Object.freeze([...input.outcomeEvidence]) });
}

export function calculateRegretPressure(regret: Pick<RegretRecord, 'severity' | 'avoidability' | 'recurrenceCount'>): number {
  return Math.min(100, severityWeight[regret.severity] * Math.max(1, regret.recurrenceCount) * avoidabilityWeight[regret.avoidability] * 20);
}

export function buildCounterfactual(input: Omit<Counterfactual, 'confidence'> & { confidence: number }): Counterfactual {
  if (input.evidence.length === 0) throw new Error('COUNTERFACTUAL requires evidence');
  if (input.confidence < 0 || input.confidence > 1) throw new Error('counterfactual confidence must be between 0 and 1');
  return Object.freeze({ ...input, evidence: Object.freeze([...input.evidence]) });
}

export function compileLearningProposal(input: LearningProposal): LearningProposal {
  if (input.sourceRegrets.length === 0) throw new Error('learning proposal requires at least one source regret');
  if (input.supportingEvidence.length === 0 && input.contradictingEvidence.length === 0) {
    throw new Error('learning proposal requires supporting or contradicting evidence');
  }
  return Object.freeze({
    ...input,
    sourceRegrets: Object.freeze([...input.sourceRegrets]),
    sourceCounterfactuals: Object.freeze([...input.sourceCounterfactuals]),
    observedFailure: Object.freeze([...input.observedFailure]),
    supportingEvidence: Object.freeze([...input.supportingEvidence]),
    contradictingEvidence: Object.freeze([...input.contradictingEvidence]),
    scope: Object.freeze({ ...input.scope, conditions: Object.freeze([...input.scope.conditions]) }),
  });
}

export function calibrateRegretPrediction(input: {
  predictionId: string;
  predictedRegret: string;
  anticipated: boolean;
  occurred: boolean;
  preventionHelped?: boolean | null;
}): RegretCalibration {
  const falsePositive = input.anticipated && !input.occurred;
  const falseNegative = !input.anticipated && input.occurred;
  const calibrationDelta = Number(input.anticipated === input.occurred) * 2 - 1;
  return Object.freeze({
    predictionId: input.predictionId,
    predictedRegret: input.predictedRegret,
    anticipated: input.anticipated,
    occurred: input.occurred,
    preventionHelped: input.preventionHelped ?? null,
    falsePositive,
    falseNegative,
    calibrationDelta,
  });
}

export function detectRegretPattern(regrets: readonly RegretRecord[], patternKey: string): RegretPattern | null {
  const matching = regrets.filter((regret) => regret.rootCause === patternKey);
  if (matching.length === 0) return null;
  const severityWeightTotal = matching.reduce((sum, regret) => sum + severityWeight[regret.severity], 0);
  const preventabilityWeightTotal = matching.reduce((sum, regret) => sum + avoidabilityWeight[regret.avoidability], 0);
  const pressure = Math.min(100, matching.reduce((sum, regret) => sum + calculateRegretPressure(regret), 0));
  return Object.freeze({
    patternKey,
    regretIds: Object.freeze(matching.map((regret) => regret.regretId)),
    recurrence: matching.length,
    severityWeight: severityWeightTotal,
    preventabilityWeight: preventabilityWeightTotal,
    pressure,
  });
}
