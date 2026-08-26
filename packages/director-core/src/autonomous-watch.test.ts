import { describe, expect, it } from 'vitest';
import { watchAndTakeNotes, type WatchFrame } from './autonomous-watch.js';
import type { CinematicStudyNote } from './cinematic-study.js';

describe('autonomous watch', () => {
  it('turns meaningful observations into timecoded study notes without storing source media', async () => {
    const notes: CinematicStudyNote[] = [];
    const frames: WatchFrame[] = [
      { timeSeconds: 12, observations: [] },
      { timeSeconds: 24, observations: [{ id: 'v1', assetId: 'film-1', source: 'cvat', modality: 'vision', kind: 'shot', time: { startSeconds: 24, endSeconds: 25 }, label: 'close-up', confidence: 0.95 }] },
      { timeSeconds: 36, observations: [{ id: 't1', assetId: 'film-1', source: 'whisper', modality: 'transcript', kind: 'speech', time: { startSeconds: 36, endSeconds: 37 }, text: 'the reveal', confidence: 0.98 }] },
    ];

    async function* stream() { for (const frame of frames) yield frame; }

    const result = await watchAndTakeNotes(
      { sourceId: 'film-1', startedAt: '2026-08-25T20:00:00Z', notesCreated: 0 },
      stream(),
      { async observe(frame) { return frame.observations; } },
      { async write(note) { notes.push(note); } },
    );

    expect(result.notesCreated).toBe(2);
    expect(notes[0]?.time?.startSeconds).toBe(24);
    expect(notes[0]?.observation).toContain('close-up');
    expect(notes[1]?.observation).toContain('the reveal');
  });
});
