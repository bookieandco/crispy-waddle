import type { ISODateTime } from './contracts.js';
import type { PredictionRealityEvaluation, PredictionSnapshot, RealityOutcome } from './prediction-reality-evaluation.js';
import type { RealityDivergenceReport } from './reality-divergence.js';
import type { RealityStateVersion } from './reality-state-event-resolver.js';

export type PredictionMissAttributionKind =
  | 'DATA_EVIDENCE'
  | 'OBSERVATION'
  | 'STATE_RECONSTRUCTION'
  | 'PLAYER_STATE'
  | 'MATCHUP_ASSUMPTION'
  | 'CALIBRATION'
  | 'MODEL'
  | 'ORDINARY_VARIANCE'
  | 'UNDETERMINED';

export interface PredictionRealityAttribution {
  kind: PredictionMissAttributionKind;
  confidence: number;
  rationale: string;
  evidenceIds: readonly string[];
  divergencePaths: readonly string[];
}

export interface PredictionRealityAttributionReport {
  predictionId: string;
  gameId: string;
  informationCutoff: ISODateTime;
  evaluatedAt: ISODateTime;
  prediction: PredictionRealityEvaluation;
  realityChanged: boolean;
  attributions: readonly PredictionRealityAttribution[];
  primaryAttribution: PredictionMissAttributionKind;
  temporalLeakageDetected: boolean;
  summary: string;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const stable = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
};

function attributionFromPath(path: string): PredictionMissAttributionKind {
  const lower = path.toLowerCase();
  if (lower.includes('evidence') || lower.includes('source')) return 'DATA_EVIDENCE';
  if (lower.includes('observation') || lower.includes('video')) return 'OBSERVATION';
  if (lower.includes('player') || lower.includes('lineup') || lower.includes('fatigue')) return 'PLAYER_STATE';
  if (lower.includes('matchup') || lower.includes('defense') || lower.includes('coverage')) return 'MATCHUP_ASSUMPTION';
  if (lower.includes('state') || lower.includes('possession') || lower.includes('event')) return 'STATE_RECONSTRUCTION';
  if (lower.includes('calibration')) return 'CALIBRATION';
  return 'MODEL';
}

function buildAttributions(divergence: RealityDivergenceReport, evaluation: PredictionRealityEvaluation): PredictionRealityAttribution[] {
  const groups = new Map<PredictionMissAttributionKind, { paths: string[]; evidence: Set<string>; severity: number }>();
  for (const item of divergence.divergences) {
    const kind = attributionFromPath(item.path);
    const current = groups.get(kind) ?? { paths: [], evidence: new Set<string>(), severity: 0 };
    current.paths.push(item.path);
    current.evidence = new Set([...current.evidence, ...item.evidenceIds]);
    current.severity = Math.max(current.severity, item.severity);
    groups.set(kind, current);
  }

  const result: PredictionRealityAttribution[] = [];
  for (const [kind, value] of groups) {
    result.push(Object.freeze({
      kind,
      confidence: clamp(value.severity),
      rationale: `${value.paths.length} observed reality divergence(s) are structurally consistent with ${kind.toLowerCase().replaceAll('_', ' ')}.`,
      evidenceIds: Object.freeze([...new Set([...value.evidence, ...evaluation.evidenceIds])].sort()),
      divergencePaths: Object.freeze([...value.paths].sort()),
    }));
  }

  if (evaluation.brierScore > 0 || evaluation.logLoss > 0) {
    const calibrationSignal = Math.min(1, evaluation.brierScore + evaluation.logLoss / 4);
    result.push(Object.freeze({
      kind: 'CALIBRATION',
      confidence: clamp(calibrationSignal),
      rationale: 'Prediction scoring shows probabilistic error, but scoring alone does not establish calibration failure.',
      evidenceIds: Object.freeze([...evaluation.evidenceIds]),
      divergencePaths: Object.freeze([]),
    }));
  }

  if (result.length === 0) {
    result.push(Object.freeze({
      kind: 'ORDINARY_VARIANCE',
      confidence: 1,
      rationale: 'No attributable structural divergence was identified; residual error remains consistent with ordinary outcome variance.',
      evidenceIds: Object.freeze([...evaluation.evidenceIds]),
      divergencePaths: Object.freeze([]),
    }));
  }
  return result;
}

export function attributePredictionReality(
  snapshot: PredictionSnapshot,
  reality: RealityOutcome,
  divergence: RealityDivergenceReport,
  evaluation: PredictionRealityEvaluation,
  evaluatedAt = evaluation.evaluatedAt,
): PredictionRealityAttributionReport {
  if (snapshot.predictionId !== evaluation.predictionId) throw new Error('Prediction snapshot and evaluation IDs must match');
  if (snapshot.gameId !== reality.gameId || evaluation.gameId !== reality.gameId) throw new Error('Prediction, evaluation, and reality game IDs must match');
  const cutoff = new Date(snapshot.informationCutoff).getTime();
  const created = new Date(snapshot.createdAt).getTime();
  const evaluated = new Date(evaluatedAt).getTime();
  if (!Number.isFinite(cutoff) || !Number.isFinite(created) || !Number.isFinite(evaluated)) throw new Error('Prediction attribution timestamps must be valid');
  if (cutoff > created) throw new Error('Prediction information cutoff cannot follow prediction creation');

  const temporalLeakageDetected = snapshot.prediction.evidence.some((evidence) => new Date(evidence.observedAt).getTime() > cutoff)
    || new Date(snapshot.prediction.featureSnapshot.asOf).getTime() > cutoff;
  const attributions = temporalLeakageDetected
    ? [Object.freeze({
      kind: 'UNDETERMINED' as const,
      confidence: 1,
      rationale: 'Prediction inputs contain evidence newer than the immutable information cutoff; attribution is quarantined.',
      evidenceIds: Object.freeze([...evaluation.evidenceIds]),
      divergencePaths: Object.freeze([]),
    })]
    : buildAttributions(divergence, evaluation);

  const primary = [...attributions].sort((a, b) => b.confidence - a.confidence || a.kind.localeCompare(b.kind))[0]?.kind ?? 'UNDETERMINED';
  return Object.freeze({
    predictionId: snapshot.predictionId,
    gameId: snapshot.gameId,
    informationCutoff: snapshot.informationCutoff,
    evaluatedAt,
    prediction: evaluation,
    realityChanged: divergence.changed,
    attributions: Object.freeze(attributions),
    primaryAttribution: primary,
    temporalLeakageDetected,
    summary: temporalLeakageDetected
      ? 'Attribution quarantined because the prediction snapshot contains post-cutoff information.'
      : divergence.changed
        ? `Prediction/reality divergence attributed across ${attributions.length} candidate cause(s); no single cause is treated as proven.`
        : 'Prediction and reality agree; no miss attribution is required.',
  });
}

export function attributionFromRealityVersion<TState>(
  snapshot: PredictionSnapshot,
  reality: RealityOutcome,
  expected: { state: TState; eventIds: readonly string[]; stateHash: string },
  actual: RealityStateVersion<TState>,
  evaluation: PredictionRealityEvaluation,
  divergence: RealityDivergenceReport,
): PredictionRealityAttributionReport {
  if (stable(expected.state) === stable(actual.state) && expected.stateHash !== actual.stateHash) {
    throw new Error('Reality state hash mismatch for structurally equal attribution states');
  }
  return attributePredictionReality(snapshot, reality, divergence, evaluation);
}
