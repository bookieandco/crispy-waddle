import type { RegretRecord } from './regret.js';
import { createRegretRecord } from './regret.js';
import type { RegretAssessment, RegretAssessmentInput } from './regret-assessment.js';

export interface RegretMaterializationInput {
  readonly assessment: RegretAssessment;
  readonly source: RegretAssessmentInput;
  readonly regretId: string;
  readonly createdAt: string;
  readonly recurrenceCount?: number;
  readonly counterfactualId?: string;
  readonly learningProposalId?: string;
}

export function materializeRegretAssessment(input: RegretMaterializationInput): RegretRecord | null {
  if (input.assessment.disposition !== 'regret') return null;
  if (!input.assessment.preventable || !input.assessment.learningWarranted) return null;
  if (input.assessment.evidence.length === 0) return null;
  if (input.source.outcomeEvidence.length === 0) return null;

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
    recurrenceCount: Math.max(1, input.recurrenceCount ?? 1),
    status: 'verified',
  });
}
