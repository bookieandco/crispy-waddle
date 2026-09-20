import type { ValidatedLearningRecord } from './validated-learning-store.js';

export interface CalibrationObservation {
  predictionId: string;
  probability: number;
  outcome: 0 | 1;
  observedAt: string;
}

export interface CalibrationWindow {
  count: number;
  meanProbability: number;
  empiricalRate: number;
  calibrationGap: number;
  brierScore: number;
}

export function calibrationWindow(observations: readonly CalibrationObservation[]): CalibrationWindow {
  if (observations.length === 0) return Object.freeze({ count: 0, meanProbability: 0, empiricalRate: 0, calibrationGap: 0, brierScore: 0 });
  for (const item of observations) if (!Number.isFinite(item.probability) || item.probability < 0 || item.probability > 1) throw new Error('Calibration probability must be within [0,1]');
  const meanProbability = observations.reduce((sum, item) => sum + item.probability, 0) / observations.length;
  const empiricalRate = observations.reduce((sum, item) => sum + item.outcome, 0) / observations.length;
  const brierScore = observations.reduce((sum, item) => sum + (item.probability - item.outcome) ** 2, 0) / observations.length;
  return Object.freeze({ count: observations.length, meanProbability, empiricalRate, calibrationGap: empiricalRate - meanProbability, brierScore });
}

export function eligibleCalibrationUpdate(
  record: ValidatedLearningRecord,
  observations: readonly CalibrationObservation[],
  minimumWindow = 20,
): number | undefined {
  if (record.target !== 'CALIBRATION' || record.disposition !== 'VALIDATED' || observations.length < minimumWindow) return undefined;
  const window = calibrationWindow(observations);
  return Math.max(-0.02, Math.min(0.02, window.calibrationGap * 0.1));
}
