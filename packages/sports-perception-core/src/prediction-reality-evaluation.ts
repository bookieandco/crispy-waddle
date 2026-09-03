import type { ActualOutcome, ISODateTime, PredictionRecord } from './contracts.js';
import { evaluatePrediction, reliabilityBuckets, type ReliabilityBucket } from './evaluation.js';

export interface ScorePair { home: number; away: number; }
export interface PredictionScoreDistribution {
  home?: DistributionSummary;
  away?: DistributionSummary;
  margin?: DistributionSummary;
  total?: DistributionSummary;
}
export interface DistributionSummary {
  mean: number;
  p10?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  p90?: number;
}
export interface PlayerPrediction {
  playerId: string;
  outcome: string;
  probability: number;
  actual?: boolean;
}
export interface PredictionSnapshot {
  predictionId: string;
  gameId: string;
  createdAt: ISODateTime;
  informationCutoff: ISODateTime;
  prediction: PredictionRecord;
  predictedWinner?: string;
  winProbability?: number;
  scoreMean?: ScorePair;
  scoreDistribution?: PredictionScoreDistribution;
  playerPredictions?: readonly PlayerPrediction[];
  modelVersion: string;
  simulationVersion?: string;
}
export interface RealityOutcome {
  gameId: string;
  actualOutcome: ActualOutcome;
  actualScore?: ScorePair;
  winner?: string;
  evidenceIds: readonly string[];
}
export interface PredictionRealityEvaluation {
  predictionId: string;
  gameId: string;
  informationCutoff: ISODateTime;
  evaluatedAt: ISODateTime;
  winnerCorrect?: boolean;
  scoreResidual?: ScorePair;
  marginResidual?: number;
  totalResidual?: number;
  brierScore: number;
  logLoss: number;
  predictedProbability: number;
  calibrationBucket?: ReliabilityBucket;
  playerResiduals: readonly PlayerResidual[];
  evidenceIds: readonly string[];
}
export interface PlayerResidual {
  playerId: string;
  outcome: string;
  predictedProbability: number;
  actual: boolean;
  residual: number;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const assertFinite = (v: number, label: string) => { if (!Number.isFinite(v)) throw new Error(`${label} must be finite`); };

function validateSnapshot(snapshot: PredictionSnapshot): void {
  if (!snapshot.predictionId.trim() || snapshot.predictionId !== snapshot.prediction.predictionId) throw new Error('Prediction snapshot identity mismatch');
  if (!snapshot.gameId.trim()) throw new Error('Game ID is required');
  if (snapshot.modelVersion !== snapshot.prediction.distribution.modelVersion) throw new Error('Prediction model version mismatch');
  if (!Number.isFinite(new Date(snapshot.informationCutoff).getTime())) throw new Error('Information cutoff must be a valid date');
  if (!Number.isFinite(new Date(snapshot.createdAt).getTime())) throw new Error('Prediction createdAt must be a valid date');
  if (new Date(snapshot.informationCutoff).getTime() > new Date(snapshot.createdAt).getTime()) throw new Error('Information cutoff cannot be after prediction creation');
  if (snapshot.winProbability !== undefined) { assertFinite(snapshot.winProbability, 'Win probability'); if (snapshot.winProbability < 0 || snapshot.winProbability > 1) throw new Error('Win probability must be within [0,1]'); }
  for (const player of snapshot.playerPredictions ?? []) { if (!player.playerId.trim() || !player.outcome.trim()) throw new Error('Player prediction identity is required'); if (player.probability < 0 || player.probability > 1 || !Number.isFinite(player.probability)) throw new Error('Player prediction probability must be within [0,1]'); }
}

export function evaluatePredictionAgainstReality(snapshot: PredictionSnapshot, reality: RealityOutcome, evaluatedAt = new Date().toISOString()): PredictionRealityEvaluation {
  validateSnapshot(snapshot);
  if (snapshot.gameId !== reality.gameId) throw new Error('Prediction and reality game IDs do not match');
  const base = evaluatePrediction(snapshot.prediction, reality.actualOutcome, evaluatedAt);
  const scoreResidual = snapshot.scoreMean && reality.actualScore ? Object.freeze({ home: reality.actualScore.home - snapshot.scoreMean.home, away: reality.actualScore.away - snapshot.scoreMean.away }) : undefined;
  const predictedMargin = snapshot.scoreMean ? snapshot.scoreMean.home - snapshot.scoreMean.away : undefined;
  const actualMargin = reality.actualScore ? reality.actualScore.home - reality.actualScore.away : undefined;
  const predictedTotal = snapshot.scoreMean ? snapshot.scoreMean.home + snapshot.scoreMean.away : undefined;
  const actualTotal = reality.actualScore ? reality.actualScore.home + reality.actualScore.away : undefined;
  const playerResiduals = Object.freeze((snapshot.playerPredictions ?? []).filter((p) => p.actual !== undefined).map((p) => Object.freeze({ playerId: p.playerId, outcome: p.outcome, predictedProbability: p.probability, actual: p.actual!, residual: Number(p.actual) - p.probability })));
  return Object.freeze({
    predictionId: snapshot.predictionId,
    gameId: snapshot.gameId,
    informationCutoff: snapshot.informationCutoff,
    evaluatedAt,
    winnerCorrect: snapshot.predictedWinner !== undefined && reality.winner !== undefined ? snapshot.predictedWinner === reality.winner : undefined,
    scoreResidual,
    marginResidual: predictedMargin !== undefined && actualMargin !== undefined ? actualMargin - predictedMargin : undefined,
    totalResidual: predictedTotal !== undefined && actualTotal !== undefined ? actualTotal - predictedTotal : undefined,
    brierScore: base.brierScore,
    logLoss: base.logLoss,
    predictedProbability: base.predictedProbability,
    playerResiduals,
    evidenceIds: Object.freeze([...new Set([...snapshot.prediction.featureSnapshot.evidenceIds, ...snapshot.prediction.evidence.map((e) => e.evidenceId), ...reality.evidenceIds])].sort()),
  });
}

export function binaryReliability(observations: readonly { probability: number; occurred: boolean }[], bucketCount = 10): readonly ReliabilityBucket[] {
  return Object.freeze(reliabilityBuckets(observations.map((o) => ({ predictedProbability: clamp(o.probability), occurred: o.occurred })), bucketCount));
}

export function meanAbsoluteResidual(values: readonly number[]): number {
  if (values.length === 0) return 0;
  values.forEach((v) => assertFinite(v, 'Residual'));
  return values.reduce((sum, v) => sum + Math.abs(v), 0) / values.length;
}
