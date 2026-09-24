import type { EvidenceRef, PredictionDistribution, Sport } from './contracts.js';

export interface ModelObservation {
  observationId: string;
  modelId: string;
  modelVersion: string;
  sport: Sport;
  eventId: string;
  observedAt: string;
  outcome: string;
  probability: number;
  confidence: number;
  evidenceIds: string[];
  inputHash: string;
}

export interface ModelDisagreement {
  outcome: string;
  minProbability: number;
  maxProbability: number;
  spread: number;
  participatingModels: string[];
}

export interface EnsembleObservation {
  ensembleId: string;
  eventId: string;
  sport: Sport;
  asOf: string;
  observations: ModelObservation[];
  distribution: PredictionDistribution;
  disagreements: ModelDisagreement[];
  agreementScore: number;
  evidenceIds: string[];
  inputHash: string;
}

export interface EnsemblePolicy {
  readonly ensembleId: string;
  readonly minModels: number;
  readonly maxProbabilitySpread: number;
  readonly requireUniqueModelVersions: boolean;
}

function finiteProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be within [0,1]`);
}

function stableHash(parts: readonly string[]): string {
  return parts.slice().sort().join('|');
}

export function validateModelObservation(observation: ModelObservation): void {
  if (!observation.observationId || !observation.modelId || !observation.modelVersion || !observation.eventId) {
    throw new Error('Model observation requires stable lineage identifiers');
  }
  finiteProbability(observation.probability, 'Model probability');
  finiteProbability(observation.confidence, 'Model confidence');
  if (!observation.inputHash || observation.evidenceIds.length === 0) throw new Error('Model observation requires input hash and evidence');
  if (!Number.isFinite(new Date(observation.observedAt).getTime())) throw new Error('Model observation observedAt must be valid');
}

export function reconcileModelObservations(
  observations: readonly ModelObservation[],
  policy: EnsemblePolicy,
  asOf: string,
): EnsembleObservation {
  if (observations.length < policy.minModels) throw new Error(`Ensemble requires at least ${policy.minModels} models`);
  const cutoff = new Date(asOf).getTime();
  if (!Number.isFinite(cutoff)) throw new Error('Ensemble asOf must be valid');

  for (const observation of observations) {
    validateModelObservation(observation);
    if (new Date(observation.observedAt).getTime() > cutoff) throw new Error(`Model observation ${observation.observationId} is after ensemble cutoff`);
  }

  const ids = new Set<string>();
  for (const observation of observations) {
    if (ids.has(observation.observationId)) throw new Error(`Duplicate model observation ${observation.observationId}`);
    ids.add(observation.observationId);
  }

  const versions = new Set(observations.map((observation) => `${observation.modelId}@${observation.modelVersion}`));
  if (policy.requireUniqueModelVersions && versions.size !== observations.length) {
    throw new Error('Ensemble requires unique model/version participants');
  }

  const outcomes = [...new Set(observations.map((observation) => observation.outcome))].sort();
  const distribution = outcomes.map((outcome) => {
    const members = observations.filter((observation) => observation.outcome === outcome);
    return {
      outcome,
      probability: members.reduce((sum, member) => sum + member.probability, 0) / observations.length,
    };
  });

  const total = distribution.reduce((sum, item) => sum + item.probability, 0);
  if (total <= 0) throw new Error('Ensemble produced no probability mass');
  const normalized = distribution.map((item) => ({ outcome: item.outcome, probability: item.probability / total }));

  const disagreements: ModelDisagreement[] = outcomes.map((outcome) => {
    const members = observations.filter((observation) => observation.outcome === outcome);
    const values = members.map((member) => member.probability);
    const minProbability = Math.min(...values);
    const maxProbability = Math.max(...values);
    return {
      outcome,
      minProbability,
      maxProbability,
      spread: maxProbability - minProbability,
      participatingModels: members.map((member) => `${member.modelId}@${member.modelVersion}`).sort(),
    };
  });

  const maxSpread = disagreements.length ? Math.max(...disagreements.map((item) => item.spread)) : 1;
  if (maxSpread > policy.maxProbabilitySpread) throw new Error(`Ensemble disagreement ${maxSpread} exceeds policy limit ${policy.maxProbabilitySpread}`);

  const agreementScore = Math.max(0, 1 - maxSpread);
  const evidenceIds = [...new Set(observations.flatMap((observation) => observation.evidenceIds))].sort();
  const inputHash = stableHash(observations.map((observation) => `${observation.modelId}@${observation.modelVersion}:${observation.inputHash}`));

  return Object.freeze({
    ensembleId: policy.ensembleId,
    eventId: observations[0].eventId,
    sport: observations[0].sport,
    asOf,
    observations: Object.freeze(observations.map((observation) => Object.freeze({ ...observation, evidenceIds: Object.freeze([...observation.evidenceIds]) }))),
    distribution: Object.freeze({ outcomes: Object.freeze(normalized), modelId: policy.ensembleId, modelVersion: versions.size ? [...versions].sort().join('+') : 'unknown' }),
    disagreements: Object.freeze(disagreements.map((item) => Object.freeze({ ...item, participatingModels: Object.freeze([...item.participatingModels]) }))),
    agreementScore,
    evidenceIds: Object.freeze(evidenceIds),
    inputHash,
  });
}

export function evidenceForEnsemble(observation: EnsembleObservation, evidence: readonly EvidenceRef[]): EvidenceRef[] {
  const ids = new Set(observation.evidenceIds);
  return evidence.filter((ref) => ids.has(ref.evidenceId));
}
