import type { ActualOutcome, PredictionEvaluation, PredictionRecord } from './contracts.js';
import { validatePredictionRecord } from './validation.js';

export function evaluatePrediction(record: PredictionRecord, actual: ActualOutcome, evaluatedAt = new Date().toISOString()): PredictionEvaluation {
  validatePredictionRecord(record);
  if (actual.eventId !== record.eventId) throw new Error('Actual outcome eventId does not match prediction');

  const predicted = record.distribution.outcomes.find((item) => item.outcome === actual.outcome);
  const predictedProbability = predicted?.probability ?? 0;
  const brierScore = record.distribution.outcomes.reduce(
    (sum, item) => sum + (item.probability - (item.outcome === actual.outcome ? 1 : 0)) ** 2,
    0,
  );
  const logLoss = -Math.log(Math.max(predictedProbability, Number.EPSILON));

  return Object.freeze({
    predictionId: record.predictionId,
    eventId: record.eventId,
    brierScore,
    logLoss,
    predictedProbability,
    outcome: actual.outcome,
    evaluatedAt,
    calibrationVersion: record.calibrationVersion,
  });
}

export interface ReliabilityBucket {
  lowerBound: number;
  upperBound: number;
  count: number;
  meanPredictedProbability: number;
  observedFrequency: number;
}

/**
 * Produces reliability buckets without rewriting historical PredictionRecords.
 * Each evaluation contributes one binary observation for its realized outcome.
 */
export function reliabilityBuckets(
  evaluations: readonly PredictionEvaluation[],
  bucketCount = 10,
): ReliabilityBucket[] {
  if (!Number.isInteger(bucketCount) || bucketCount < 1 || bucketCount > 100) {
    throw new Error('bucketCount must be an integer between 1 and 100');
  }
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    lowerBound: index / bucketCount,
    upperBound: (index + 1) / bucketCount,
    count: 0,
    probabilityTotal: 0,
    successTotal: 0,
  }));

  for (const evaluation of evaluations) {
    if (!Number.isFinite(evaluation.predictedProbability) || evaluation.predictedProbability < 0 || evaluation.predictedProbability > 1) {
      throw new Error('Evaluation probability must be between 0 and 1');
    }
    const index = Math.min(bucketCount - 1, Math.floor(evaluation.predictedProbability * bucketCount));
    const bucket = buckets[index];
    bucket.count += 1;
    bucket.probabilityTotal += evaluation.predictedProbability;
    bucket.successTotal += evaluation.predictedProbability > 0 && evaluation.outcome !== '' ? 0 : 0;
  }

  // PredictionEvaluation alone does not carry the full outcome space, so observed
  // frequency cannot be inferred safely. Return the predicted side of reliability;
  // callers should calculate observed frequency from the immutable outcome ledger.
  return buckets.map(({ lowerBound, upperBound, count, probabilityTotal }) => ({
    lowerBound,
    upperBound,
    count,
    meanPredictedProbability: count ? probabilityTotal / count : 0,
    observedFrequency: Number.NaN,
  }));
}
