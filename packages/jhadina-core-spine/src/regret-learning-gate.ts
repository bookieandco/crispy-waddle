import { createHash } from 'node:crypto';
import type { EvidenceRef } from './types.js';
import type { LearningProposal } from './regret.js';

export type LearningApprovalStatus = 'pending' | 'approved' | 'rejected' | 'superseded';
export type LearningCommitTarget = 'knowledge' | 'policy' | 'reasoning' | 'process';

export interface LearningApproval {
  readonly approvalId: string;
  readonly proposalId: string;
  /** SHA-256 fingerprint of the exact proposal contents approved by the human gate. */
  readonly proposalHash: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly status: LearningApprovalStatus;
  readonly evidence: readonly EvidenceRef[];
}

export interface GovernedLearningCommit {
  readonly commitId: string;
  readonly proposalId: string;
  readonly proposalHash: string;
  readonly approvalId: string;
  readonly target: LearningCommitTarget;
  readonly targetId: string;
  readonly committedAt: string;
  readonly committedBy: string;
  readonly evidence: readonly EvidenceRef[];
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Canonicalize only proposal data that defines its semantic content. Status is
 * intentionally included so an approval cannot be replayed against a changed
 * lifecycle state under the same proposal ID.
 */
export function canonicalizeLearningProposal(proposal: LearningProposal): string {
  return JSON.stringify({
    proposalId: proposal.proposalId,
    sourceRegrets: [...proposal.sourceRegrets],
    sourceCounterfactuals: [...proposal.sourceCounterfactuals],
    learningType: proposal.learningType,
    observedFailure: [...proposal.observedFailure],
    proposedLearning: proposal.proposedLearning,
    supportingEvidence: [...proposal.supportingEvidence],
    contradictingEvidence: [...proposal.contradictingEvidence],
    scope: {
      domain: proposal.scope.domain,
      conditions: [...proposal.scope.conditions],
    },
    preventability: proposal.preventability,
    status: proposal.status,
  });
}

export function fingerprintLearningProposal(proposal: LearningProposal): string {
  return createHash('sha256').update(canonicalizeLearningProposal(proposal), 'utf8').digest('hex');
}

/** Approval is a separate append-only governance artifact; it never mutates the proposal. */
export function approveLearningProposal(input: {
  readonly approvalId: string;
  readonly proposal: LearningProposal;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly evidence: readonly EvidenceRef[];
}): LearningApproval {
  if (!input.approvalId.trim()) throw new Error('learning_approval_id_required');
  if (!input.approvedBy.trim()) throw new Error('learning_approval_actor_required');
  if (!input.proposal.proposalId.trim()) throw new Error('learning_proposal_id_required');
  if (input.proposal.status !== 'proposed' && input.proposal.status !== 'challenged') {
    throw new Error('learning_proposal_not_approvable');
  }
  if (input.evidence.length === 0) throw new Error('learning_approval_evidence_required');

  return freeze({
    approvalId: input.approvalId,
    proposalId: input.proposal.proposalId,
    proposalHash: fingerprintLearningProposal(input.proposal),
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    status: 'approved' as const,
    evidence: [...input.evidence],
  });
}

/** A policy/knowledge commit requires an explicit approval artifact and an unchanged proposal fingerprint. */
export function createGovernedLearningCommit(input: {
  readonly commitId: string;
  readonly proposal: LearningProposal;
  readonly approval: LearningApproval;
  readonly target: LearningCommitTarget;
  readonly targetId: string;
  readonly committedAt: string;
  readonly committedBy: string;
  readonly evidence: readonly EvidenceRef[];
}): GovernedLearningCommit {
  if (!input.commitId.trim()) throw new Error('learning_commit_id_required');
  if (!input.targetId.trim()) throw new Error('learning_commit_target_required');
  if (input.approval.status !== 'approved') throw new Error('learning_approval_required');
  if (input.approval.proposalId !== input.proposal.proposalId) throw new Error('learning_approval_proposal_mismatch');
  const proposalHash = fingerprintLearningProposal(input.proposal);
  if (input.approval.proposalHash !== proposalHash) throw new Error('learning_approval_proposal_hash_mismatch');
  if (!input.proposal.sourceRegrets.length) throw new Error('learning_commit_source_regret_required');
  if (input.evidence.length === 0) throw new Error('learning_commit_evidence_required');
  if (input.target === 'policy' && input.proposal.learningType !== 'policy') {
    throw new Error('learning_commit_target_type_mismatch');
  }

  return freeze({
    commitId: input.commitId,
    proposalId: input.proposal.proposalId,
    proposalHash,
    approvalId: input.approval.approvalId,
    target: input.target,
    targetId: input.targetId,
    committedAt: input.committedAt,
    committedBy: input.committedBy,
    evidence: [...input.evidence],
  });
}

/** Deliberately no executor, capability, policy mutation, or canonical-state mutation is exposed here. */
export function isLearningCommitApproved(approval: LearningApproval): boolean {
  return approval.status === 'approved';
}
