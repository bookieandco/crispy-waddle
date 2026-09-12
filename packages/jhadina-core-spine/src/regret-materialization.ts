import type { RegretRecord } from './regret.js';
import { createRegretRecord } from './regret.js';
import type { RegretAssessment, RegretAssessmentInput } from './regret-assessment.js';
import type { RegretMemory } from './regret-memory.js';
import { nextRegretRecurrence } from './regret-recurrence.js';

export interface RegretMaterializationInput {
  readonly assessment: RegretAssessment;
  readonly source: RegretAssessmentInput;
  readonly regretId: string;
  readonly createdAt: string;
  readonly recurrenceCount: number;
  readonly counterfactualId?: string;
  readonly learningProposalId?: string;
}

export interface AuthoritativeRegretMaterializationInput {
  readonly assessment: RegretAssessment;
  readonly source: RegretAssessmentInput;
  readonly regretId: string;
  readonly createdAt: string;
  readonly userId: string;
  readonly memory: RegretMemory;
  readonly counterfactualId?: string;
  readonly learningProposalId?: string;
}

function materialize(input: RegretMaterializationInput): RegretRecord | null {
  if (input.assessment.disposition !== 'regret') return null;
  if (!input.assessment.preventable || !input.assessment.learningWarranted) return null;
  if (input.assessment.evidence.length === 0) return null;
  if (input.source.outcomeEvidence.length === 0) return null;
  if (!Number.isInteger(input.recurrenceCount) || input.recurrenceCount < 1) {
    throw new Error('regret recurrence count must be a positive integer');
  }

  return createRegretRecord({
    regretId: input.regretId,
    subjectType: input.source.subjectType,
    subjectId: input.source.subjectId,
    createdAt: input.createdAt,
    originalBelief: input.source.originalBelief,
    expectedOutcome: input.source.expectedOutcome,
    actualOutcome: input.source.actualOutcome,
    outcomeEvidence: input.assessment.evidence,
    discrepancy: input.source.discrepancy,
    severity: input.source.severity,
    avoidability: input.source.avoidability,
    rootCause: input.source.rootCause,
    counterfactualId: input.counterfactualId,
    learningProposalId: input.learningProposalId,
    recurrenceCount: input.recurrenceCount,
    status: 'verified',
  });
}

/**
 * Compatibility boundary for callers that already possess an independently
 * derived recurrence count. It does not derive authority from caller input.
 * New application code should use materializeRegretAssessmentWithMemory().
 */
export function materializeRegretAssessment(input: RegretMaterializationInput): RegretRecord | null {
  return materialize(input);
}

/**
 * Authoritative path: recurrence is derived from user-scoped historical memory.
 * No caller-supplied recurrence count is accepted, and history is never mutated.
 */
export async function materializeRegretAssessmentWithMemory(
  input: AuthoritativeRegretMaterializationInput,
): Promise<RegretRecord | null> {
  if (!input.userId) throw new Error('regret recurrence userId is required');

  if (!input.source.rootCause) {
    return materialize({
      ...input,
      recurrenceCount: 1,
    });
  }

  const history = input.memory.findRecurrences(input.userId, input.source.rootCause);
  const recurrenceCount = nextRegretRecurrence(history, input.source.rootCause);

  return materialize({
    ...input,
    recurrenceCount,
  });
}
