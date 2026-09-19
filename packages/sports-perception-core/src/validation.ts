import type {
  EvidenceRef,
  FeatureSnapshot,
  PredictionDistribution,
  PredictionRecord,
  RealityState,
} from './contracts.js';

const EPSILON = 1e-9;

function assertFinite01(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be finite and between 0 and 1`);
  }
}

function assertIso(value: string, label: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid ISO datetime`);
  return date;
}

export function validateEvidence(evidence: EvidenceRef, cutoff?: string): void {
  const observed = assertIso(evidence.observedAt, 'observedAt');
  const received = assertIso(evidence.receivedAt, 'receivedAt');
  if (received.getTime() < observed.getTime()) {
    throw new Error('Evidence receivedAt cannot precede observedAt');
  }
  if (cutoff && received.getTime() > assertIso(cutoff, 'cutoff').getTime()) {
    throw new Error(`Evidence ${evidence.evidenceId} was received after prediction cutoff`);
  }
  if (!evidence.evidenceId || !evidence.sourceId || !evidence.contentHash) {
    throw new Error('Evidence requires evidenceId, sourceId, and contentHash');
  }
}

export function validateFeatureSnapshot(snapshot: FeatureSnapshot, cutoff: string): void {
  const asOf = assertIso(snapshot.asOf, 'featureSnapshot.asOf');
  const cutoffDate = assertIso(cutoff, 'predictionCutoff');
  if (asOf.getTime() > cutoffDate.getTime()) {
    throw new Error('Feature snapshot cannot contain information after prediction cutoff');
  }
  if (!snapshot.snapshotId || !snapshot.contentHash || !snapshot.featureSetVersion) {
    throw new Error('Feature snapshot requires snapshotId, contentHash, and featureSetVersion');
  }
}

export function validateDistribution(distribution: PredictionDistribution): void {
  if (!distribution.outcomes.length) throw new Error('Prediction distribution requires at least one outcome');
  const names = new Set<string>();
  let sum = 0;
  for (const item of distribution.outcomes) {
    if (!item.outcome || names.has(item.outcome)) throw new Error('Prediction outcomes must be non-empty and unique');
    names.add(item.outcome);
    assertFinite01(item.probability, `Probability for ${item.outcome}`);
    sum += item.probability;
  }
  if (Math.abs(sum - 1) > EPSILON) throw new Error(`Prediction probabilities must sum to 1; got ${sum}`);
  if (!distribution.modelId || !distribution.modelVersion) {
    throw new Error('Prediction distribution requires modelId and modelVersion');
  }
}

export function validatePredictionRecord(record: PredictionRecord): void {
  const cutoff = assertIso(record.predictionCutoff, 'predictionCutoff');
  const created = assertIso(record.createdAt, 'createdAt');
  if (created.getTime() < cutoff.getTime()) throw new Error('Prediction cannot be created before its cutoff');
  if (!record.predictionId || !record.eventId || !record.inputHash || !record.calibrationVersion) {
    throw new Error('Prediction record is missing required identity/version/hash fields');
  }
  assertFinite01(record.confidence, 'confidence');
  assertFinite01(record.uncertainty, 'uncertainty');
  validateFeatureSnapshot(record.featureSnapshot, record.predictionCutoff);
  for (const evidence of record.evidence) validateEvidence(evidence, record.predictionCutoff);
  validateDistribution(record.distribution);
}

export function validateRealityState(state: RealityState): void {
  assertIso(state.asOf, 'RealityState.asOf');
  if (!state.eventId || state.stateVersion < 1 || !state.stateHash) {
    throw new Error('RealityState requires eventId, positive stateVersion, and stateHash');
  }
  if (!state.canonical) throw new Error('Only canonical RealityState may enter the prediction pipeline');
  if (!state.sourceEvidenceIds.length) throw new Error('Canonical RealityState requires source evidence');
}

/**
 * Freezes the prediction boundary so callers cannot mutate the original record
 * after validation. Historical predictions must remain immutable.
 */
export function freezePredictionRecord(record: PredictionRecord): Readonly<PredictionRecord> {
  validatePredictionRecord(record);
  for (const outcome of record.distribution.outcomes) Object.freeze(outcome);
  Object.freeze(record.distribution.outcomes);
  Object.freeze(record.distribution);
  Object.freeze(record.featureSnapshot.evidenceIds);
  Object.freeze(record.featureSnapshot);
  Object.freeze(record.evidence);
  return Object.freeze(record);
}
