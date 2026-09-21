import type { BehavioralDecision } from './behavioral-kernel.js';
import type { ExpressionPlan } from './expression-kernel.js';

export type DriftDimension =
  | 'directness' | 'warmth' | 'verbosity' | 'formality' | 'reasoningDepth'
  | 'workflowContinuity' | 'humor' | 'profanityIntensity' | 'quipIntensity'
  | 'disagreementDirectness' | 'creativeLatitude';

export type DriftSeverity = 'none' | 'watch' | 'material' | 'critical';

export interface BehaviorVector extends Record<DriftDimension, number> {}

export interface BehaviorAttribution {
  personalityVersion: number;
  modelId?: string;
  modelVersion?: string;
  runtimeVersion?: string;
  promptVersion?: string;
  expressionKernelVersion?: string;
}

export interface ExpectedBehavior {
  requestId: string;
  observedAt: string;
  vector: BehaviorVector;
  expression: Pick<ExpressionPlan, 'mode' | 'responseLength' | 'tone' | 'reasoningDepth' | 'interactionStyle' | 'creativeStyle' | 'explanationStyle' | 'decisionPresentation'>;
  context: { serious: boolean; requiresPrecision: boolean };
  attribution: BehaviorAttribution;
}

export interface ObservedBehavior {
  requestId: string;
  observedAt: string;
  vector: BehaviorVector;
  expression?: Partial<ExpectedBehavior['expression']>;
  attribution: BehaviorAttribution;
}

export interface DriftSample {
  requestId: string;
  expectedAt: string;
  observedAt: string;
  dimensionDrift: Record<DriftDimension, number>;
  expressionMismatches: string[];
  score: number;
}

export interface DriftAssessment {
  receiptId: string;
  evaluatedAt: string;
  sampleCount: number;
  score: number;
  severity: DriftSeverity;
  sustained: boolean;
  dimensionDrift: Record<DriftDimension, number>;
  expressionMismatchRate: number;
  attributionChanges: string[];
  samples: DriftSample[];
  authority: 'observation_only';
}

export interface DriftPolicy {
  minimumSamples: number;
  watchThreshold: number;
  materialThreshold: number;
  criticalThreshold: number;
  sustainedFraction: number;
}

export const DEFAULT_DRIFT_POLICY: DriftPolicy = {
  minimumSamples: 5,
  watchThreshold: 0.12,
  materialThreshold: 0.22,
  criticalThreshold: 0.35,
  sustainedFraction: 0.6,
};

const dimensions: DriftDimension[] = [
  'directness', 'warmth', 'verbosity', 'formality', 'reasoningDepth',
  'workflowContinuity', 'humor', 'profanityIntensity', 'quipIntensity',
  'disagreementDirectness', 'creativeLatitude',
];

function clamp(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('behavior values must be finite');
  return Math.max(0, Math.min(1, value));
}

export function expectedBehaviorFromDecision(
  requestId: string,
  decision: BehavioralDecision,
  expression: ExpressionPlan,
  attribution: BehaviorAttribution,
  context: { serious?: boolean; requiresPrecision?: boolean } = {},
  observedAt = new Date().toISOString(),
): ExpectedBehavior {
  const p = decision.posture;
  return {
    requestId,
    observedAt,
    vector: {
      directness: clamp(p.directness), warmth: clamp(p.warmth), verbosity: clamp(p.verbosity),
      formality: clamp(p.formality), reasoningDepth: clamp(p.reasoningDepth),
      workflowContinuity: clamp(p.workflowContinuity), humor: clamp(p.humor),
      profanityIntensity: clamp(p.profanityIntensity), quipIntensity: clamp(p.quipIntensity),
      disagreementDirectness: clamp(p.disagreementDirectness), creativeLatitude: clamp(p.creativeLatitude),
    },
    expression: {
      mode: expression.mode, responseLength: expression.responseLength, tone: expression.tone,
      reasoningDepth: expression.reasoningDepth, interactionStyle: expression.interactionStyle,
      creativeStyle: expression.creativeStyle, explanationStyle: expression.explanationStyle,
      decisionPresentation: expression.decisionPresentation,
    },
    context: { serious: context.serious === true, requiresPrecision: context.requiresPrecision === true },
    attribution: { ...attribution },
  };
}

function expressionMismatches(expected: ExpectedBehavior, observed: ObservedBehavior): string[] {
  if (!observed.expression) return [];
  return Object.entries(observed.expression)
    .filter(([key, value]) => value !== undefined && expected.expression[key as keyof ExpectedBehavior['expression']] !== value)
    .map(([key]) => key)
    .sort();
}

function attributionChanges(expected: ExpectedBehavior, observed: ObservedBehavior): string[] {
  const keys: Array<keyof BehaviorAttribution> = ['personalityVersion','modelId','modelVersion','runtimeVersion','promptVersion','expressionKernelVersion'];
  return keys.filter((key) => observed.attribution[key] !== undefined && expected.attribution[key] !== observed.attribution[key]).map(String);
}

export function evaluateBehaviorDrift(
  pairs: ReadonlyArray<{ expected: ExpectedBehavior; observed: ObservedBehavior }>,
  policy: DriftPolicy = DEFAULT_DRIFT_POLICY,
  evaluatedAt = new Date().toISOString(),
  receiptId = crypto.randomUUID(),
): DriftAssessment {
  if (pairs.length === 0) throw new RangeError('at least one behavior pair is required');
  const samples = pairs.map(({ expected, observed }): DriftSample => {
    if (expected.requestId !== observed.requestId) throw new Error('behavior pair requestId mismatch');
    const dimensionDrift = Object.fromEntries(dimensions.map((d) => [d, Math.abs(clamp(expected.vector[d]) - clamp(observed.vector[d]))])) as Record<DriftDimension, number>;
    const mismatches = expressionMismatches(expected, observed);
    const numeric = dimensions.reduce((sum, d) => sum + dimensionDrift[d], 0) / dimensions.length;
    const categorical = mismatches.length / Math.max(Object.keys(expected.expression).filter((k) => expected.expression[k as keyof ExpectedBehavior['expression']] !== undefined).length, 1);
    return { requestId: expected.requestId, expectedAt: expected.observedAt, observedAt: observed.observedAt, dimensionDrift, expressionMismatches: mismatches, score: clamp(0.85 * numeric + 0.15 * categorical) };
  });
  const dimensionDrift = Object.fromEntries(dimensions.map((d) => [d, samples.reduce((s, x) => s + x.dimensionDrift[d], 0) / samples.length])) as Record<DriftDimension, number>;
  const score = samples.reduce((s, x) => s + x.score, 0) / samples.length;
  const expressionMismatchRate = samples.filter((x) => x.expressionMismatches.length > 0).length / samples.length;
  const sustained = pairs.length >= policy.minimumSamples && samples.filter((x) => x.score >= policy.watchThreshold).length / samples.length >= policy.sustainedFraction;
  const severity: DriftSeverity = !sustained ? 'none' : score >= policy.criticalThreshold ? 'critical' : score >= policy.materialThreshold ? 'material' : score >= policy.watchThreshold ? 'watch' : 'none';
  const changes = [...new Set(pairs.flatMap(({expected, observed}) => attributionChanges(expected, observed)))].sort();
  return { receiptId, evaluatedAt, sampleCount: samples.length, score, severity, sustained, dimensionDrift, expressionMismatchRate, attributionChanges: changes, samples, authority: 'observation_only' };
}
