import { describe, expect, it } from 'vitest';
import {
  InMemoryLearningRecordRepository,
  createLearningRecord,
  createLearningRecordFromSpine,
  type LearningRecordInput,
} from './learning-record.js';
import type { DecisionProposal } from './types.js';

const evidence = {
  id: 'evidence-1',
  source: 'test',
  observedAt: '2026-09-01T12:00:00Z',
  summary: 'Observed result',
};

const input: LearningRecordInput = {
  id: 'learning-1',
  occurredAt: '2026-09-01T12:00:00Z',
  domain: 'research',
  experience: { id: 'experience-1' },
  decision: { proposalId: 'proposal-1', policyDecisionId: 'policy-1', actionRequestId: 'action-1', actionResultId: 'result-1' },
  evidence: [evidence],
  prediction: { hypothesis: 'The source is useful', expectedOutcome: 'supported', confidence: 0.7 },
  outcome: { status: 'success', actualOutcome: 'supported', observedAt: '2026-09-01T12:05:00Z', evidence: [evidence] },
  learningUpdate: { kind: 'reinforce', target: 'research:source-1:intent-1', reason: 'Outcome supported the prediction', updateVersion: 'research-learning-v1' },
  provenance: { source: 'research-test', actor: 'jhadina', correlationId: 'corr-1' },
};

describe('LearningRecord', () => {
  it('creates an immutable canonical learning fact', () => {
    const record = createLearningRecord(input);
    expect(record.schemaVersion).toBe('1.0');
    expect(record.experienceId).toBe('experience-1');
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.evidence)).toBe(true);
    expect(Object.isFrozen(record.outcome)).toBe(true);
    expect(Object.isFrozen(record.outcome.evidence)).toBe(true);
  });

  it('requires evidence for observed outcomes', () => {
    expect(() => createLearningRecord({ ...input, evidence: [], outcome: { ...input.outcome, evidence: [] } })).toThrow('learning_record_evidence_required');
  });

  it('allows unknown and not-observed outcomes without evidence', () => {
    expect(() => createLearningRecord({ ...input, evidence: [], outcome: { ...input.outcome, status: 'unknown', evidence: [] } })).not.toThrow();
    expect(() => createLearningRecord({ ...input, id: 'learning-2', evidence: [], outcome: { ...input.outcome, status: 'not-observed', evidence: [] } })).not.toThrow();
  });

  it('preserves full decision lineage when bridged from spine artifacts', () => {
    const decision: DecisionProposal = {
      id: 'proposal-2',
      contextId: 'context-1',
      disposition: 'PROCEED',
      recommendation: 'Research',
      rationale: 'Knowledge gap',
      evidence: [evidence],
      uncertainty: ['freshness'],
      alternatives: [],
    };
    const record = createLearningRecordFromSpine({
      id: 'learning-2',
      occurredAt: input.occurredAt,
      domain: 'research',
      experience: { id: 'experience-2' },
      decision,
      policy: { id: 'policy-2', proposalId: decision.id, allowed: true, reason: 'authorized', requiredApproval: false, evaluatedAt: input.occurredAt },
      action: { id: 'action-2', proposalId: decision.id, capability: 'research', operation: 'investigate', input: {}, reversible: true, consequenceLevel: 'low' },
      result: { id: 'result-2', requestId: 'action-2', success: true, completedAt: input.occurredAt },
      outcome: input.outcome,
      prediction: input.prediction,
      learningUpdate: input.learningUpdate,
      provenance: input.provenance,
    });
    expect(record.decision).toEqual({ proposalId: 'proposal-2', policyDecisionId: 'policy-2', actionRequestId: 'action-2', actionResultId: 'result-2' });
    expect(record.evidence).toHaveLength(2);
  });
});

describe('InMemoryLearningRecordRepository', () => {
  it('rejects duplicate IDs and supports deterministic queries', async () => {
    const repository = new InMemoryLearningRecordRepository();
    const record = createLearningRecord(input);
    await repository.append(record);
    await expect(repository.append(record)).rejects.toThrow('learning_record_duplicate_id');
    await expect(repository.get(record.id)).resolves.toEqual(record);
    await expect(repository.listByCorrelation('corr-1')).resolves.toEqual([record]);
    await expect(repository.listByDomain('research')).resolves.toEqual([record]);
  });
});
