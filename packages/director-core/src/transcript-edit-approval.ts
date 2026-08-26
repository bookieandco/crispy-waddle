import type { EditableTimeline } from './timeline-model.js';
import type { TranscriptSelection } from './transcript-editor-bridge.js';
import { executeTranscriptCut } from './transcript-edit-executor.js';
import { rippleAudioGap } from './audio-ripple.js';

export type TranscriptEditProposal = {
  id: string;
  action: 'cut' | 'delete';
  selection: TranscriptSelection;
  status: 'pending' | 'approved' | 'rejected';
};

export type ApprovedTranscriptEditResult = {
  timeline: EditableTimeline;
  proposal: TranscriptEditProposal;
  affectedClipIds: string[];
};

export function createTranscriptEditProposal(
  selection: TranscriptSelection,
  action: 'cut' | 'delete' = 'cut',
): TranscriptEditProposal {
  return {
    id: crypto.randomUUID(),
    action,
    selection,
    status: 'pending',
  };
}

/** Applies only an explicitly approved transcript edit, then ripples the dialogue track. */
export function approveTranscriptEdit(
  timeline: EditableTimeline,
  proposal: TranscriptEditProposal,
): ApprovedTranscriptEditResult {
  if (proposal.status !== 'approved') {
    throw new Error(`Transcript edit is not approved: ${proposal.id}`);
  }

  const result = executeTranscriptCut(timeline, proposal.selection);
  if (result.affectedClipIds.length === 0) return { timeline: result.timeline, proposal, affectedClipIds: [] };

  const sourceTrack = result.timeline.tracks.find(track =>
    track.clips.some(clip => result.affectedClipIds.includes(clip.id)),
  );
  if (!sourceTrack) return { timeline: result.timeline, proposal, affectedClipIds: result.affectedClipIds };

  const nextTimeline = rippleAudioGap(result.timeline, {
    trackId: sourceTrack.id,
    cutStartSeconds: proposal.selection.startSeconds,
    cutEndSeconds: proposal.selection.endSeconds,
    scope: 'track',
  });

  return { timeline: nextTimeline, proposal, affectedClipIds: result.affectedClipIds };
}
