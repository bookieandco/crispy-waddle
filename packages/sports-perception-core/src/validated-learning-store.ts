import type { LearningCandidate, LearningDisposition, LearningTarget } from './prediction-learning.js';

export interface LearningValidationEvidence {
  validationId: string;
  candidateId: string;
  observedAt: string;
  evidenceIds: readonly string[];
  supportsCandidate: boolean;
  realityStateVersion?: number;
  realityStateHash?: string;
}

export interface LearningEligibilityPolicy {
  minimumSupportingValidations: number;
  minimumDistinctGames: number;
  minimumAttributionConfidence: number;
  maximumAbsoluteDelta: number;
  requireRealityStateHash: boolean;
}

export interface ValidatedLearningRecord extends LearningCandidate {
  supportingValidationIds: readonly string[];
  contradictingValidationIds: readonly string[];
  validatedAt?: string;
}

export const DEFAULT_LEARNING_ELIGIBILITY_POLICY: LearningEligibilityPolicy = Object.freeze({
  minimumSupportingValidations: 2,
  minimumDistinctGames: 2,
  minimumAttributionConfidence: 0.7,
  maximumAbsoluteDelta: 0.05,
  requireRealityStateHash: true,
});

function assertDate(value: string): void {
  if (!Number.isFinite(new Date(value).getTime())) throw new Error('Learning validation timestamp must be valid');
}

export class ValidatedLearningStore {
  private readonly candidates = new Map<string, LearningCandidate>();
  private readonly validations = new Map<string, LearningValidationEvidence>();

  constructor(private readonly policy: LearningEligibilityPolicy = DEFAULT_LEARNING_ELIGIBILITY_POLICY) {}

  propose(candidate: LearningCandidate): LearningCandidate {
    if (candidate.disposition !== 'PROPOSED') throw new Error('Only proposed learning candidates may enter validation');
    const existing = this.candidates.get(candidate.candidateId);
    if (existing) return existing;
    this.candidates.set(candidate.candidateId, Object.freeze({ ...candidate, evidenceIds: Object.freeze([...candidate.evidenceIds]) }));
    return candidate;
  }

  validate(evidence: LearningValidationEvidence): ValidatedLearningRecord {
    assertDate(evidence.observedAt);
    if (!evidence.validationId.trim() || !evidence.candidateId.trim()) throw new Error('Learning validation requires identifiers');
    if (this.validations.has(evidence.validationId)) throw new Error(`Learning validation ${evidence.validationId} already exists`);
    const candidate = this.candidates.get(evidence.candidateId);
    if (!candidate) throw new Error(`Unknown learning candidate ${evidence.candidateId}`);
    this.validations.set(evidence.validationId, Object.freeze({ ...evidence, evidenceIds: Object.freeze([...evidence.evidenceIds]) }));
    return this.record(candidate.candidateId);
  }

  record(candidateId: string): ValidatedLearningRecord {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) throw new Error(`Unknown learning candidate ${candidateId}`);
    const all = [...this.validations.values()].filter((item) => item.candidateId === candidateId);
    const support = all.filter((item) => item.supportsCandidate);
    const contradiction = all.filter((item) => !item.supportsCandidate);
    const hasReality = !this.policy.requireRealityStateHash || support.every((item) => Boolean(item.realityStateHash));
    const eligible = candidate.attributionConfidence >= this.policy.minimumAttributionConfidence
      && Math.abs(candidate.boundedDelta) <= this.policy.maximumAbsoluteDelta
      && support.length >= this.policy.minimumSupportingValidations
      && new Set(support.map((item) => item.realityStateHash ?? item.validationId)).size >= this.policy.minimumDistinctGames
      && hasReality
      && contradiction.length === 0;
    const disposition: LearningDisposition = contradiction.length > support.length ? 'REJECTED' : eligible ? 'VALIDATED' : 'PROPOSED';
    return Object.freeze({
      ...candidate,
      disposition,
      supportingValidationIds: Object.freeze(support.map((item) => item.validationId).sort()),
      contradictingValidationIds: Object.freeze(contradiction.map((item) => item.validationId).sort()),
      validatedAt: eligible ? support.map((item) => item.observedAt).sort().at(-1) : undefined,
    });
  }

  list(target?: LearningTarget): readonly ValidatedLearningRecord[] {
    return Object.freeze([...this.candidates.keys()].map((id) => this.record(id)).filter((item) => !target || item.target === target));
  }
}
