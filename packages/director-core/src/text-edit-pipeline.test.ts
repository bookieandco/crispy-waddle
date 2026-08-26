import { describe, expect, it } from 'vitest';
import type { EditableTimeline } from './timeline-model.js';
import { createTextEditProposal } from './text-edit-pipeline.js';
import { approveTranscriptEdit } from './transcript-edit-approval.js';

const baseTimeline = (): EditableTimeline => ({
  id: 'timeline-1',
  projectId: 'project-1',
  tracks: [
    { id: 'dialogue', type: 'audio', name: 'Dialogue', clips: [
      { id: 'dialogue-1', trackId: 'dialogue', assetId: 'take-1', startSeconds: 0, durationSeconds: 12, sourceInSeconds: 0, sourceOutSeconds: 12, metadata: { role: 'dialogue' } },
      { id: 'dialogue-2', trackId: 'dialogue', assetId: 'take-2', startSeconds: 12, durationSeconds: 3, sourceInSeconds: 0, sourceOutSeconds: 3, metadata: { role: 'dialogue' } },
    ] },
    { id: 'music', type: 'audio', name: 'Music', clips: [
      { id: 'music-1', trackId: 'music', assetId: 'music-1', startSeconds: 0, durationSeconds: 30, sourceInSeconds: 0, sourceOutSeconds: 30, metadata: { role: 'music' } },
    ] },
  ],
  versions: [],
});

describe('text edit pipeline', () => {
  it('requires approval before mutating the timeline', () => {
    const transcript = {
      assetId: 'take-1',
      segments: [{ id: 'seg-1', startSeconds: 2, endSeconds: 5, text: 'we are going to talk about the project' }],
    };
    const pipeline = createTextEditProposal('Delete the part where I say "we are going to talk about the project"', baseTimeline(), transcript);
    expect(pipeline).not.toBeNull();
    expect(pipeline!.proposal.status).toBe('pending');

    expect(() => approveTranscriptEdit(baseTimeline(), pipeline!.proposal)).toThrow(/not approved/);
  });

  it('executes only after approval and leaves music stationary', () => {
    const timeline = baseTimeline();
    const transcript = {
      assetId: 'take-1',
      segments: [{ id: 'seg-1', startSeconds: 2, endSeconds: 5, text: 'we are going to talk about the project' }],
    };
    const pipeline = createTextEditProposal('Delete the part where I say "we are going to talk about the project"', timeline, transcript)!;
    const approved = { ...pipeline.proposal, status: 'approved' as const };
    const result = approveTranscriptEdit(timeline, approved);

    expect(result.affectedClipIds).toContain('dialogue-1');
    expect(result.timeline.tracks.find(track => track.id === 'music')?.clips[0].startSeconds).toBe(0);
    expect(result.timeline.tracks.find(track => track.id === 'dialogue')?.clips.find(clip => clip.id === 'dialogue-2')?.startSeconds).toBe(9);
  });
});
