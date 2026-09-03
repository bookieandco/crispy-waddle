import type { PredictionMissAttributionKind, PredictionRealityAttributionReport } from './prediction-reality-attribution.js';

export type LearningTarget =
  | 'PLAYER_STATE'
  | 'MATCHUP_RULE'
  | 'CALIBRATION'
  | 'SCENARIO_PRIOR'
  | 'MODEL_CHALLENGER';

export type LearningDisposition = 'PROPOSED' | 'VALIDATED' | 'REJECTED' | 'QUARANTINED';

export interface LearningCandidate {
  candidateId: string;
  predictionId: string;
  gameId: string;
  target: LearningTarget;
  parameterPath: string;
  proposedDelta: number;
  boundedDelta: number;
  evidenceIds: readonly string[];
  attributionKind: PredictionMissAttributionKind;
  attributionConfidence: number;
  realityStateVersion?: number;
  realityStateHash?: string;
  modelVersion: string;
  calibrationVersion: string;
  featureSetVersion: string;
  disposition: LearningDisposition;
  rationale: string;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const fingerprint = (value: unknown): string => {
  const text = JSON.stringify(value, (_, nested) => nested && typeof nested === 'object' && !Array.isArray(nested)
    ? Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b)))
    : nested);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
};

function candidateFor(
  report: PredictionRealityAttributionReport,
  attribution: PredictionRealityAttributionReport['attributions'][number],
): LearningCandidate | undefined {
  if (report.temporalLeakageDetected || attribution.kind === 'ORDINARY_VARIANCE' || attribution.kind === 'UNDETERMINED') return undefined;
  const confidence = attribution.confidence;
  if (confidence < 0.7) return undefined;

  const base = attribution.kind === 'PLAYER_STATE'
    ? { target: 'PLAYER_STATE' as const, parameterPath: 'player.state', scale: 0.05 }
    : attribution.kind === 'MATCHUP_ASSUMPTION'
      ? { target: 'MATCHUP_RULE' as const, parameterPath: 'matchup.rule', scale: 0.05 }
      : attribution.kind === 'CALIBRATION'
        ? { target: 'CALIBRATION' as const, parameterPath: 'calibration.pending', scale: 0.02 }
        : attribution.kind === 'MODEL'
          ? { target: 'MODEL_CHALLENGER' as const, parameterPath: 'model.challenger', scale: 1 }
          : attribution.kind === 'STATE_RECONSTRUCTION' || attribution.kind === 'DATA_EVIDENCE' || attribution.kind === 'OBSERVATION'
            ? undefined
            : attribution.kind === 'SCENARIO_PRIOR'
              ? { target: 'SCENARIO_PRIOR' as const, parameterPath: 'scenario.prior', scale: 0.05 }
              : undefined;
  if (!base) return undefined;

  const direction = report.prediction.meanAbsoluteResidual > 0 ? -1 : 1;
  const proposedDelta = base.target === 'MODEL_CHALLENGER' ? 0 : direction * confidence * base.scale;
  const boundedDelta = base.target === 'MODEL_CHALLENGER' ? 0 : clamp(proposedDelta, -base.scale, base.scale);
  const candidateId = `learn:${fingerprint({ predictionId: report.predictionId, gameId: report.gameId, kind: attribution.kind, paths: attribution.divergencePaths })}`;

  return Object.freeze({
    candidateId,
    predictionId: report.predictionId,
    gameId: report.gameId,
    target: base.target,
    parameterPath: base.parameterPath,
    proposedDelta,
    boundedDelta,
    evidenceIds: Object.freeze([...attribution.evidenceIds].sort()),
    attributionKind: attribution.kind,
    attributionConfidence: confidence,
    modelVersion: report.prediction.modelVersion,
    calibrationVersion: report.prediction.calibrationVersion,
    featureSetVersion: report.prediction.featureSetVersion,
    disposition: 'PROPOSED',
    rationale: base.target === 'MODEL_CHALLENGER'
      ? 'Model attribution is recorded as a challenger signal; no model parameters are changed automatically.'
      : base.target === 'CALIBRATION'
        ? 'Calibration learning is staged as a candidate and requires an aggregate calibration window before update.'
        : 'Attribution passed the evidence gate; parameter change is bounded and remains a proposal until validation.',
  });
}

export function proposeLearningCandidates(report: PredictionRealityAttributionReport): readonly LearningCandidate[] {
  return Object.freeze(report.attributions.map((attribution) => candidateFor(report, attribution)).filter((candidate): candidate is LearningCandidate => candidate !== undefined));
}

export class LearningCandidateStore {
  private readonly candidates = new Map<string, LearningCandidate>();

  add(candidate: LearningCandidate): LearningCandidate {
    const existing = this.candidates.get(candidate.candidateId);
    if (existing) return existing;
    this.candidates.set(candidate.candidateId, candidate);
    return candidate;
  }

  addFromReport(report: PredictionRealityAttributionReport): readonly LearningCandidate[] {
    return Object.freeze(proposeLearningCandidates(report).map((candidate) => this.add(candidate)));
  }

  list(): readonly LearningCandidate[] {
    return Object.freeze([...this.candidates.values()]);
  }
}
