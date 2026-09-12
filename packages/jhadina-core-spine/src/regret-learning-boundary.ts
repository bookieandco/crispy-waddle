import type { LearningProposal, RegretRecord } from './regret.js';
import { compileLearningProposal } from './regret.js';

/**
 * Learning compilation is advisory only. It may describe proposed knowledge,
 * reasoning, process, or policy changes, but it cannot authorize or apply them.
 */
export interface RegretLearningBoundaryInput {
  readonly proposal: LearningProposal;
  readonly sourceRegrets: readonly RegretRecord[];
}

export interface RegretLearningBoundaryResult {
  readonly proposal: LearningProposal;
  readonly sourceRegretIds: readonly string[];
  readonly requiresHumanApproval: true;
  readonly canMutatePolicy: false;
  readonly canMutateCanonicalKnowledge: false;
  readonly canAuthorizeExecution: false;
  readonly canGrantCapability: false;
}

export function compileRegretLearning(input: RegretLearningBoundaryInput): RegretLearningBoundaryResult {
  const proposal = compileLearningProposal(input.proposal);
  const sourceIds = new Set(input.sourceRegrets.map((regret) => regret.regretId));

  if (proposal.sourceRegrets.some((regretId) => !sourceIds.has(regretId))) {
    throw new Error('learning proposal references a regret not present in the supplied verified source set');
  }

  if (input.sourceRegrets.some((regret) => regret.status !== 'verified' && regret.status !== 'learned')) {
    throw new Error('learning proposal requires verified or previously learned source regrets');
  }

  return Object.freeze({
    proposal,
    sourceRegretIds: Object.freeze([...proposal.sourceRegrets]),
    requiresHumanApproval: true,
    canMutatePolicy: false,
    canMutateCanonicalKnowledge: false,
    canAuthorizeExecution: false,
    canGrantCapability: false,
  });
}
