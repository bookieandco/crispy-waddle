import type { ActionRequest, ActionResult, AuditEvent, DecisionProposal, EvidenceRef, Experience, PolicyDecision } from './types.js';

export type LearningOutcomeStatus =
  | 'success'
  | 'partial'
  | 'failure'
  | 'unknown'
  | 'contradicted'
  | 'not-observed';

export type LearningUpdateKind =
  | 'create'
  | 'reinforce'
  | 'weaken'
  | 'invalidate'
  | 'replace'
  | 'no-change';

export interface LearningOutcomeRecord {
  status: LearningOutcomeStatus;
  actualOutcome?: string;
  observedAt: string;
  evidence: EvidenceRef[];
  predictionError?: number;
}

export interface LearningDecisionIdentity {
  proposalId: string;
  policyDecisionId?: string;
  actionRequestId?: string;
  actionResultId?: string;
}

export interface LearningPrediction {
  hypothesis?: string;
  expectedOutcome?: string;
  confidence?: number;
}

export interface LearningUpdateReason {
  kind: LearningUpdateKind;
  target: string;
  reason: string;
  previousState?: unknown;
  resultingState?: unknown;
  updateVersion: string;
}

export interface LearningProvenance {
  source: string;
  actor: 'user' | 'jhadina' | 'system' | 'external';
  correlationId: string;
}

/**
 * Canonical durable learning fact.
 *
 * This is an append-only record of what happened and why a learning update
 * was justified. It is not the learned state itself. Learners must derive
 * projections from these records rather than mutating this record in place.
 */
export interface LearningRecord {
  id: string;
  schemaVersion: string;
  occurredAt: string;
  domain: string;
  experienceId?: string;
  decision: LearningDecisionIdentity;
  evidence: EvidenceRef[];
  prediction?: LearningPrediction;
  outcome: LearningOutcomeRecord;
  learningUpdate: LearningUpdateReason;
  provenance: LearningProvenance;
}

export interface LearningRecordInput {
  id: string;
  schemaVersion?: string;
  occurredAt: string;
  domain: string;
  experience?: Pick<Experience, 'id'>;
  decision: LearningDecisionIdentity;
  evidence: EvidenceRef[];
  prediction?: LearningPrediction;
  outcome: LearningOutcomeRecord;
  learningUpdate: LearningUpdateReason;
  provenance: LearningProvenance;
}

export interface LearningRecordRepository {
  append(record: LearningRecord): Promise<void>;
  get(id: string): Promise<LearningRecord | undefined>;
  listByCorrelation(correlationId: string): Promise<LearningRecord[]>;
  listByDomain(domain: string): Promise<LearningRecord[]>;
}

export function createLearningRecord(input: LearningRecordInput): LearningRecord {
  if (!input.id.trim()) throw new Error('learning_record_id_required');
  if (!input.domain.trim()) throw new Error('learning_record_domain_required');
  if (!input.provenance.correlationId.trim()) throw new Error('learning_record_correlation_required');
  if (!input.decision.proposalId.trim()) throw new Error('learning_record_proposal_required');
  if (!input.evidence.length && input.outcome.status !== 'unknown' && input.outcome.status !== 'not-observed') {
    throw new Error('learning_record_evidence_required');
  }
  if (!input.learningUpdate.target.trim()) throw new Error('learning_record_update_target_required');
  if (!input.learningUpdate.reason.trim()) throw new Error('learning_record_update_reason_required');
  return Object.freeze({
    ...input,
    schemaVersion: input.schemaVersion ?? '1.0',
    experienceId: input.experience?.id,
    evidence: Object.freeze([...input.evidence]),
    outcome: Object.freeze({ ...input.outcome, evidence: Object.freeze([...input.outcome.evidence]) }),
  }) as LearningRecord;
}

/**
 * Bridges the canonical spine artifacts into a learning-record input without
 * granting the learning layer authority over policy or action execution.
 */
export function createLearningRecordFromSpine(input: {
  experience?: Pick<Experience, 'id'>;
  decision: DecisionProposal;
  policy?: PolicyDecision;
  action?: ActionRequest;
  result?: ActionResult;
  auditEvents?: AuditEvent[];
  domain: string;
  outcome: LearningOutcomeRecord;
  prediction?: LearningPrediction;
  learningUpdate: LearningUpdateReason;
  provenance: LearningProvenance;
  id: string;
  occurredAt: string;
}): LearningRecord {
  const evidence = [
    ...input.decision.evidence,
    ...(input.outcome.evidence ?? []),
  ];

  return createLearningRecord({
    id: input.id,
    occurredAt: input.occurredAt,
    domain: input.domain,
    experience: input.experience,
    decision: {
      proposalId: input.decision.id,
      policyDecisionId: input.policy?.id,
      actionRequestId: input.action?.id,
      actionResultId: input.result?.id,
    },
    evidence,
    prediction: input.prediction,
    outcome: input.outcome,
    learningUpdate: input.learningUpdate,
    provenance: input.provenance,
  });
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
