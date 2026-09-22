import type { TimelineCommand } from './timeline-command';

export type TimelineProposalStatus = 'draft' | 'ready' | 'accepted' | 'rejected' | 'stale';

export interface ProposedTimelineChange {
  id: string;
  command: TimelineCommand;
  dependsOn: readonly string[];
  evidenceIds: readonly string[];
  previewArtifactIds: readonly string[];
  explanation: string;
}

export interface TimelineEditProposal {
  id: string;
  projectId: string;
  baseTimelineVersionId: string;
  baseSnapshotHash: string;
  status: TimelineProposalStatus;
  changes: readonly ProposedTimelineChange[];
  createdBy: 'jhadina' | 'user' | 'system';
  authority: 'PROPOSAL_ONLY';
}

export interface TimelineProposalSelectionDecision {
  valid: boolean;
  reasons: readonly string[];
  selectedChangeIds: readonly string[];
}

/**
 * Validates a ghost-diff selection before any accepted changes are replayed
 * through the normal governed timeline mutation path.
 */
export function validateTimelineProposalSelection(
  proposal: TimelineEditProposal,
  input: {
    currentTimelineVersionId: string;
    currentSnapshotHash: string;
    selectedChangeIds: readonly string[];
  },
): TimelineProposalSelectionDecision {
  const reasons: string[] = [];
  if (proposal.status !== 'ready') reasons.push('DIRECTOR_TIMELINE_PROPOSAL_NOT_READY');
  if (proposal.baseTimelineVersionId !== input.currentTimelineVersionId) {
    reasons.push('DIRECTOR_TIMELINE_PROPOSAL_BASE_VERSION_STALE');
  }
  if (proposal.baseSnapshotHash !== input.currentSnapshotHash) {
    reasons.push('DIRECTOR_TIMELINE_PROPOSAL_BASE_HASH_STALE');
  }

  const byId = new Map(proposal.changes.map((change) => [change.id, change]));
  const selected = new Set(input.selectedChangeIds);
  if (!selected.size) reasons.push('DIRECTOR_TIMELINE_PROPOSAL_SELECTION_EMPTY');

  for (const id of selected) {
    const change = byId.get(id);
    if (!change) {
      reasons.push(`DIRECTOR_TIMELINE_PROPOSAL_CHANGE_UNKNOWN:${id}`);
      continue;
    }
    if (!change.evidenceIds.length) reasons.push(`DIRECTOR_TIMELINE_PROPOSAL_EVIDENCE_REQUIRED:${id}`);
    if (!change.previewArtifactIds.length) reasons.push(`DIRECTOR_TIMELINE_PROPOSAL_PREVIEW_REQUIRED:${id}`);
    for (const dependency of change.dependsOn) {
      if (!selected.has(dependency)) {
        reasons.push(`DIRECTOR_TIMELINE_PROPOSAL_DEPENDENCY_REQUIRED:${id}:${dependency}`);
      }
    }
  }

  return Object.freeze({
    valid: reasons.length === 0,
    reasons: Object.freeze(reasons),
    selectedChangeIds: Object.freeze([...selected]),
  });
}
