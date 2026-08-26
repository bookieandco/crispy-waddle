import { describe, expect, it } from 'vitest';
import type { EditableTimeline } from './timeline-model.js';
import { applyTranscriptPauseEdit } from './transcript-pause-edit.js';

const timeline = (): EditableTimeline => ({
  id: 'tl-1',
  projectId: 'p-1',
  tracks: [
    { id: 'dialogue', type: 'audio', name: 'Dialogue', clips: [
      { id: 'dlg', trackId: 'dialogue', assetId: 'voice', startSeconds: 0, durationSeconds: 10, sourceInSeconds: 0, sourceOutSeconds: 10, metadata: { role: 'dialogue' } },
      { id: 'later', trackId: 'dialogue', assetId: 'voice-2', startSeconds: 12, durationSeconds: 2, sourceInSeconds: 0, sourceOutSeconds: 2, metadata: { role: 'dialogue' } },
    ] },
    { id: 'music', type: 'audio', name: 'Music', clips: [
      { id: 'music-1', trackId: 'music', assetId: 'music', startSeconds: 0, durationSeconds: 20, sourceInSeconds: 0, sourceOutSeconds: 20, metadata: { role: 'music' } },
    ] },
    { id: 'video', type: 'video', name: 'Video', clips: [
      { id: 'video-1', trackId: 'video', assetId: 'video', startSeconds: 0, durationSeconds: 20, sourceInSeconds: 0, sourceOutSeconds: 20 },
    ] },
  ],
  versions: [],
});

describe('applyTranscriptPauseEdit', () => {
  it('removes a pause using source-aware segments and ripples dialogue only', () => {
    const result = applyTranscriptPauseEdit(timeline(), 'dlg', [
      { id: 'a', startSeconds: 0, endSeconds: 3, text: 'hello' },
      { id: 'b', startSeconds: 4.5, endSeconds: 6, text: 'world' },
    ], { pauseThresholdSeconds: 1 });

    const dialogue = result.timeline.tracks.find(t => t.id === 'dialogue')!;
    expect(result.cutsApplied).toBe(1);
    expect(result.rippleSeconds).toBeCloseTo(1.5);
    expect(dialogue.clips).toHaveLength(3);
    expect(dialogue.clips.find(c => c.id === 'later')?.startSeconds).toBeCloseTo(10.5);
    expect(result.timeline.tracks.find(t => t.id === 'music')?.clips[0].startSeconds).toBe(0);
    expect(result.timeline.tracks.find(t => t.id === 'video')?.clips[0].startSeconds).toBe(0);
  });
});
