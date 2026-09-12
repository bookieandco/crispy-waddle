import type {
  ActionRequest,
  ActionResult,
  DecisionProposal,
  EvidenceRef,
  PolicyDecision,
} from './types.js';

export type LearningOutcomeStatus = 'success' | 'failure' | 'unknown' | 'not-observed';

export interface LearningRecordInput {
  id: string;
  occurredAt: string;
  domain: string;
  experience: { id: string };
  decision: {
    proposalId: string;
    policyDecisionId: string;
    actionRequestId: string;
    actionResultId: string;
  };
  evidence: EvidenceRef[];
  prediction: {
    hypothesis: string;
    expectedOutcome: string;
    confidence: number;
  };
  outcome: {
    status: LearningOutcomeStatus;
    actualOutcome?: string;
    observedAt?: string;
    evidence: EvidenceRef[];
  };
  learningUpdate: {
    kind: string;
    target: string;
    reason: string;
    updateVersion: string;
  };
  provenance: {
    source: string;
    actor: string;
    correlationId: string;
  };
}

export interface LearningRecord extends Readonly<Omit<LearningRecordInput, 'experience' | 'decision'> & {
  schemaVersion: '1.0';
  experienceId: string;
  decision: Readonly<LearningRecordInput['decision']>;
}> {}

export interface SpineLearningRecordInput {
  id: string;
  occurredAt: string;
  domain: string;
  experience: { id: string };
  decision: DecisionProposal;
  policy: PolicyDecision;
  action: ActionRequest;
  result: ActionResult;
  outcome: LearningRecordInput['outcome'];
  prediction: LearningRecordInput['prediction'];
  learningUpdate: LearningRecordInput['learningUpdate'];
  provenance: LearningRecordInput['provenance'];
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function createLearningRecord(input: LearningRecordInput): LearningRecord {
  if (!input.id.trim()) throw new Error('learning_record_id_required');
  if (!input.domain.trim()) throw new Error('learning_record_domain_required');
  if (!input.evidence.length && input.outcome.status !== 'unknown' && input.outcome.status !== 'not-observed') {
    throw new Error('learning_record_evidence_required');
  }
  if (input.outcome.status === 'success' || input.outcome.status === 'failure') {
    if (!input.outcome.evidence.length) throw new Error('learning_record_evidence_required');
  }
  if (input.prediction.confidence < 0 || input.prediction.confidence > 1) {
    throw new Error('learning_record_confidence_invalid');
  }

  const record: LearningRecord = {
    schemaVersion: '1.0',
    id: input.id,
    occurredAt: input.occurredAt,
    domain: input.domain,
    experienceId: input.experience.id,
    decision: { ...input.decision },
    evidence: [...input.evidence],
    prediction: { ...input.prediction },
    outcome: { ...input.outcome, evidence: [...input.outcome.evidence] },
    learningUpdate: { ...input.learningUpdate },
    provenance: { ...input.provenance },
  };

  return freeze(record);
}

export function createLearningRecordFromSpine(input: SpineLearningRecordInput): LearningRecord {
  return createLearningRecord({
    id: input.id,
    occurredAt: input.occurredAt,
    domain: input.domain,
    experience: input.experience,
    decision: {
      proposalId: input.decision.id,
      policyDecisionId: input.policy.id,
      actionRequestId: input.action.id,
      actionResultId: input.result.id,
    },
    evidence: [...input.decision.evidence, ...input.outcome.evidence],
    prediction: input.prediction,
    outcome: input.outcome,
    learningUpdate: input.learningUpdate,
    provenance: input.provenance,
  });
}

export interface LearningRecordRepository {
  append(record: LearningRecord): Promise<void>;
  get(id: string): Promise<LearningRecord | undefined>;
  listByCorrelation(correlationId: string): Promise<LearningRecord[]>;
  listByDomain(domain: string): Promise<LearningRecord[]>;
}

export class InMemoryLearningRecordRepository implements LearningRecordRepository {
  private readonly records = new Map<string, LearningRecord>();

  async append(record: LearningRecord): Promise<void> {
    if (this.records.has(record.id)) throw new Error('learning_record_duplicate_id');
    this.records.set(record.id, record);
  }

  async get(id: string): Promise<LearningRecord | undefined> {
    return this.records.get(id);
  }

  async listByCorrelation(correlationId: string): Promise<LearningRecord[]> {
    return [...this.records.values()].filter((record) => record.provenance.correlationId === correlationId);
  }

  async listByDomain(domain: string): Promise<LearningRecord[]> {
    return [...this.records.values()].filter((record) => record.domain === domain);
  }
}
