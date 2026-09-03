import type { ActualOutcome, ISODateTime, PredictionRecord } from './contracts.js';

export interface CalibrationBin {
  lower: number;
  upper: number;
  count: number;
  meanPredicted: number;
  observedRate: number;
  absoluteError: number;
}

export interface CalibrationReport {
  sampleCount: number;
  brierScore: number;
  logLoss: number;
  expectedCalibrationError: number;
  bins: CalibrationBin[];
  calibrationVersion: string;
}

export interface TemporalEvaluationCase {
  prediction: PredictionRecord;
  outcome: ActualOutcome;
}

export interface TemporalLeakageViolation {
  predictionId: string;
  kind: 'EVIDENCE_AFTER_CUTOFF' | 'FEATURE_AFTER_CUTOFF' | 'OUTCOME_BEFORE_CUTOFF' | 'INVALID_ORDER';
  evidenceId?: string;
  timestamp?: ISODateTime;
}

export interface TemporalEvaluationReport {
  cases: number;
  violations: TemporalLeakageViolation[];
  valid: boolean;
}

function time(value: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ISO datetime: ${value}`);
  return parsed;
}

function clamp(value: number): number {
  return Math.min(1 - 1e-12, Math.max(1e-12, value));
}

export function evaluateCalibration(cases: readonly TemporalEvaluationCase[], calibrationVersion: string, binCount = 10): CalibrationReport {
  if (!calibrationVersion) throw new Error('calibrationVersion is required');
  if (!Number.isInteger(binCount) || binCount < 2 || binCount > 100) throw new Error('binCount must be an integer between 2 and 100');
  if (cases.length === 0) throw new Error('Calibration requires at least one case');

  const bins = Array.from({ length: binCount }, (_, index) => ({
    lower: index / binCount,
    upper: (index + 1) / binCount,
    predictions: [] as number[],
    outcomes: [] as number[],
  }));

  let brierSum = 0;
  let logLossSum = 0;
  for (const item of cases) {
    const predicted = item.prediction.distribution.outcomes.find((outcome) => outcome.outcome === item.outcome.outcome)?.probability ?? 0;
    const observed = 1;
    brierSum += (predicted - observed) ** 2;
    logLossSum -= Math.log(clamp(predicted));
    const index = Math.min(binCount - 1, Math.floor(predicted * binCount));
    bins[index].predictions.push(predicted);
    bins[index].outcomes.push(observed);
  }

  const reports: CalibrationBin[] = bins.map((bin) => {
    const count = bin.predictions.length;
    const meanPredicted = count ? bin.predictions.reduce((a, b) => a + b, 0) / count : 0;
    const observedRate = count ? bin.outcomes.reduce((a, b) => a + b, 0) / count : 0;
    return {
      lower: bin.lower,
      upper: bin.upper,
      count,
      meanPredicted,
      observedRate,
      absoluteError: Math.abs(meanPredicted - observedRate),
    };
  });

  const expectedCalibrationError = reports.reduce((sum, bin) => sum + (bin.count / cases.length) * bin.absoluteError, 0);
  return Object.freeze({
    sampleCount: cases.length,
    brierScore: brierSum / cases.length,
    logLoss: logLossSum / cases.length,
    expectedCalibrationError,
    bins: Object.freeze(reports.map((bin) => Object.freeze(bin))),
    calibrationVersion,
  });
}

export function auditTemporalEvaluation(cases: readonly TemporalEvaluationCase[]): TemporalEvaluationReport {
  const violations: TemporalLeakageViolation[] = [];
  for (const item of cases) {
    const cutoff = time(item.prediction.predictionCutoff);
    const created = time(item.prediction.createdAt);
    const featureTime = time(item.prediction.featureSnapshot.asOf);
    const outcomeTime = time(item.outcome.observedAt);

    if (featureTime > cutoff) {
      violations.push({ predictionId: item.prediction.predictionId, kind: 'FEATURE_AFTER_CUTOFF', timestamp: item.prediction.featureSnapshot.asOf });
    }
    if (created < cutoff) {
      violations.push({ predictionId: item.prediction.predictionId, kind: 'INVALID_ORDER', timestamp: item.prediction.createdAt });
    }
    if (outcomeTime < cutoff) {
      violations.push({ predictionId: item.prediction.predictionId, kind: 'OUTCOME_BEFORE_CUTOFF', timestamp: item.outcome.observedAt });
    }
    for (const evidence of item.prediction.evidence) {
      if (time(evidence.receivedAt) > cutoff) {
        violations.push({ predictionId: item.prediction.predictionId, kind: 'EVIDENCE_AFTER_CUTOFF', evidenceId: evidence.evidenceId, timestamp: evidence.receivedAt });
      }
    }
  }
  return Object.freeze({ cases: cases.length, violations: Object.freeze(violations), valid: violations.length === 0 });
}
