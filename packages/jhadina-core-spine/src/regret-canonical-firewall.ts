import type { EvidenceRef, RegretContext } from './types.js';
import type { LearningApproval } from './regret-learning-gate.js';
import { fingerprintLearningProposal } from './regret-learning-gate.js';
import type { LearningProposal } from './regret.js';

/**
 * Regret is never a canonical fact. This firewall provides the only core-spine
 * projection for consumers that need to reason about regret without allowing
 * regret context to masquerade as knowledge, memory, policy, or authority.
 */
export interface RegretReasoningSignal {
  readonly signalId: string;
  readonly memoryId: string;
  readonly discrepancy: string;
  readonly rootCause?: string;
  readonly recurrenceCount: number;
  readonly score: number;
  readonly salience: number;
}

export interface CanonicalLearningAdmission {
  readonly proposalId: string;
  readonly proposalHash: string;
  readonly approvalId: string;
  readonly target: 'knowledge' | 'reasoning' | 'process' | 'policy';
  readonly evidence: readonly EvidenceRef[];
  readonly explicitlyApproved: true;
}

export function projectRegretToReasoningSignal(context: RegretContext, signalId: string): RegretReasoningSignal {
  if (!signalId.trim()) throw new Error('regret_signal_id_required');
  if (!context.memoryId.trim()) throw new Error('regret_memory_id_required');
  if (context.score < 0 || context.score > 1) throw new Error('regret_signal_score_invalid');
  if (context.salience < 0 || context.salience > 1) throw new Error('regret_signal_salience_invalid');
  if (!Number.isInteger(context.recurrenceCount) || context.recurrenceCount < 0) {
    throw new Error('regret_signal_recurrence_invalid');
  }

  return Object.freeze({
    signalId,
    memoryId: context.memoryId,
    discrepancy: context.discrepancy,
    rootCause: context.rootCause,
    recurrenceCount: context.recurrenceCount,
    score: context.score,
    salience: context.salience,
  });
}

/**
 * Canonical admission is deliberately narrow: it accepts an approved artifact
 * bound to the exact proposal contents plus independent commit evidence.
 * Regret context itself can never satisfy this boundary.
 */
export function admitApprovedLearningToCanonicalState(input: {
  readonly proposal: LearningProposal;
  readonly approval: LearningApproval;
  readonly target: CanonicalLearningAdmission['target'];
  readonly evidence: readonly EvidenceRef[];
}): CanonicalLearningAdmission {
  if (!input.proposal.proposalId.trim()) throw new Error('canonical_learning_proposal_required');
  if (input.approval.status !== 'approved') throw new Error('canonical_learning_approval_required');
  if (input.approval.proposalId !== input.proposal.proposalId) {
    throw new Error('canonical_learning_approval_proposal_mismatch');
  }

  const proposalHash = fingerprintLearningProposal(input.proposal);
  if (input.approval.proposalHash !== proposalHash) {
    throw new Error('canonical_learning_approval_proposal_hash_mismatch');
  }
  if (input.evidence.length === 0) throw new Error('canonical_learning_evidence_required');

  return Object.freeze({
    proposalId: input.proposal.proposalId,
    proposalHash,
    approvalId: input.approval.approvalId,
    target: input.target,
    evidence: Object.freeze([...input.evidence]),
    explicitlyApproved: true,
  });
}

/** Regret context has no shape that can be accepted as canonical state. */
export function rejectRegretAsCanonicalSource(_context: RegretContext): never {
  throw new Error('regret_context_is_not_canonical_state');
}
