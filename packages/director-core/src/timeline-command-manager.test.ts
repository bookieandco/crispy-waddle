import { describe, expect, it } from 'vitest';
import { createTimeline } from './timeline-model';
import { TimelineCommandManager } from './timeline-command-manager';

describe('TimelineCommandManager', () => {
  it('executes, undoes, and redoes a timeline command', () => {
    const timeline = createTimeline({ projectId: 'p1', fps: 30, width: 1920, height: 1080, durationSeconds: 10, playheadSeconds: 0, transitions: [], markers: [], tracks: [{ id: 'v1', name: 'Video 1', kind: 'video', index: 0, clips: [{ id: 'c1', assetId: 'a1', trackId: 'v1', startSeconds: 0, durationSeconds: 5, effects: [], generativeRegions: [] }] }] });
    const manager = new TimelineCommandManager(timeline);
    manager.execute({ type: 'move', clipId: 'c1', startSeconds: 2 });
    expect(manager.timeline.tracks[0].clips[0].startSeconds).toBe(2);
    expect(manager.canUndo).toBe(true);
    manager.undo();
    expect(manager.timeline.tracks[0].clips[0].startSeconds).toBe(0);
    expect(manager.canRedo).toBe(true);
    manager.redo();
    expect(manager.timeline.tracks[0].clips[0].startSeconds).toBe(2);
  });

  it('clears redo history after a new edit', () => {
    const timeline = createTimeline({ projectId: 'p1', fps: 30, width: 1920, height: 1080, durationSeconds: 10, playheadSeconds: 0, transitions: [], markers: [], tracks: [] });
    const manager = new TimelineCommandManager(timeline);
    manager.execute({ type: 'set-opacity', clipId: 'missing', opacity: 0.5 });
    expect(manager.canUndo).toBe(false);
  });
});
