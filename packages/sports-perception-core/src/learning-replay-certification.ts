import type { LearningCandidate } from './prediction-learning.js';
import { auditLearningCandidate, auditValidatedLearning } from './learning-safety-gate.js';
import type { LearningValidationEvidence, ValidatedLearningRecord } from './validated-learning-store.js';
import { ValidatedLearningStore } from './validated-learning-store.js';

export interface LearningReplayInput {
  candidate: LearningCandidate;
  validations: readonly LearningValidationEvidence[];
}

export interface LearningCertification {
  certificationId: string;
  candidateId: string;
  passed: boolean;
  deterministicReplay: boolean;
  temporalIntegrity: boolean;
  rollbackSafe: boolean;
  safetyGatePassed: boolean;
  failures: readonly string[];
  finalRecord: ValidatedLearningRecord;
}

const stable = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stable(object[key])}`).join(',')}}`;
};

const fingerprint = (value: unknown): string => {
  let hash = 2166136261;
  for (const char of stable(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
};

function replay(input: LearningReplayInput): ValidatedLearningRecord {
  const store = new ValidatedLearningStore();
  store.propose(input.candidate);
  for (const validation of input.validations) store.validate(validation);
  return store.record(input.candidate.candidateId);
}

function temporalIntegrity(input: LearningReplayInput): boolean {
  const cutoff = input.candidate.realityStateVersion;
  const validationTimes = input.validations.map((item) => new Date(item.observedAt).getTime());
  return validationTimes.every(Number.isFinite)
    && input.validations.every((item) => cutoff === undefined || item.realityStateVersion === undefined || item.realityStateVersion >= cutoff);
}

export function certifyLearningReplay(input: LearningReplayInput): LearningCertification {
  const failures: string[] = [];
  const candidateAudit = auditLearningCandidate(input.candidate);
  if (!candidateAudit.passed) failures.push(...candidateAudit.failures);
  const first = replay(input);
  const second = replay({ candidate: Object.freeze({ ...input.candidate, evidenceIds: Object.freeze([...input.candidate.evidenceIds]) }), validations: [...input.validations].reverse().reverse() });
  const deterministicReplay = stable(first) === stable(second);
  if (!deterministicReplay) failures.push('learning replay is not deterministic');
  const temporal = temporalIntegrity(input);
  if (!temporal) failures.push('learning validation violates reality-state temporal ordering');
  const finalAudit = auditValidatedLearning(first);
  if (!finalAudit.passed) failures.push(...finalAudit.failures);
  const rollbackStore = new ValidatedLearningStore();
  rollbackStore.propose(input.candidate);
  const rollbackSafe = rollbackStore.record(input.candidate.candidateId).disposition === 'PROPOSED';
  if (!rollbackSafe) failures.push('learning state cannot return to pre-validation proposal state');
  const certificationId = `learning-cert:${fingerprint({ candidateId: input.candidate.candidateId, validations: input.validations.map((item) => item.validationId).sort(), final: first })}`;
  return Object.freeze({
    certificationId,
    candidateId: input.candidate.candidateId,
    passed: failures.length === 0,
    deterministicReplay,
    temporalIntegrity: temporal,
    rollbackSafe,
    safetyGatePassed: candidateAudit.passed && finalAudit.passed,
    failures: Object.freeze([...new Set(failures)]),
    finalRecord: first,
  });
}
