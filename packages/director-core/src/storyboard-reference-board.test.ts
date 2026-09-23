import { describe, expect, it } from 'vitest';
import {
  compileReferenceBoardExport,
  compileReferenceFrameDirective,
  validateStoryboardReferenceBoard,
  type StoryboardReferenceBoard,
} from './storyboard-reference-board.js';

function board(): StoryboardReferenceBoard {
  return {
    id: 'board:refs:1',
    projectId: 'film:1',
    title: 'Reference board',
    scratchAudioAssetId: 'audio:scratch',
    frames: [
      {
        id: 'frame:1',
        sourceAssetId: 'video:reference',
        sourceTimeSeconds: 3.25,
        stillAssetId: 'still:1',
        stillSha256: 'a'.repeat(64),
        label: 'SHOT 1A — HERO ENTERS',
        crop: { x: 0.1, y: 0.05, width: 0.8, height: 0.8, aspectRatio: '16:9' },
        metadata: {
          sceneNo: '1',
          shotNo: '1A',
          shotSize: 'wide',
          cameraAngle: 'low',
          lens: '24mm',
          movement: 'slow push-in',
          lighting: 'single warm practical',
          mood: 'uneasy',
        },
        annotations: [{
          id: 'arrow:1',
          kind: 'arrow',
          from: { x: 0.2, y: 0.6 },
          to: { x: 0.6, y: 0.6 },
          label: 'actor crosses frame',
        }],
        holdSeconds: 2,
        prompt: 'Approved provider-neutral frame prompt.',
        evidenceIds: ['capture:frame:1'],
      },
      {
        id: 'frame:2',
        sourceAssetId: 'image:reference',
        stillAssetId: 'still:2',
        stillSha256: 'b'.repeat(64),
        label: 'SHOT 1B — CLOSE REACTION',
        crop: { x: 0.25, y: 0.1, width: 0.5, height: 0.75, aspectRatio: '9:16' },
        metadata: { shotSize: 'close-up', lens: '85mm' },
        annotations: [{
          id: 'text:1',
          kind: 'text',
          at: { x: 0.5, y: 0.2 },
          text: 'keep eye line here',
        }],
        holdSeconds: 1.5,
        evidenceIds: ['capture:frame:2'],
      },
    ],
    authority: 'DIRECTOR_REFERENCE_BOARD',
  };
}

describe('storyboard reference board', () => {
  it('builds deterministic animatic timing from per-frame holds', () => {
    const result = compileReferenceBoardExport(board());
    expect(result.totalDurationSeconds).toBe(3.5);
    expect(result.animatic).toEqual([
      expect.objectContaining({ frameId: 'frame:1', startSeconds: 0, endSeconds: 2 }),
      expect.objectContaining({ frameId: 'frame:2', startSeconds: 2, endSeconds: 3.5 }),
    ]);
    expect(result.promptFrameIds).toEqual(['frame:1']);
  });

  it('compiles crop, lens and annotations into a reusable frame directive', () => {
    const directive = compileReferenceFrameDirective(board().frames[0]!);
    expect(directive).toContain('Match framing/crop: 16:9');
    expect(directive).toContain('Lens: 24mm');
    expect(directive).toContain('actor crosses frame');
  });

  it('rejects crops that extend beyond normalized source coordinates', () => {
    const invalid = board();
    invalid.frames = [{
      ...invalid.frames[0]!,
      crop: { ...invalid.frames[0]!.crop, x: 0.8, width: 0.5 },
    }];
    expect(validateStoryboardReferenceBoard(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REFERENCE_CROP_INVALID' }),
    ]));
  });

  it('requires provenance for extracted reference stills', () => {
    const invalid = board();
    invalid.frames = [{ ...invalid.frames[0]!, evidenceIds: [] }];
    expect(validateStoryboardReferenceBoard(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REFERENCE_FRAME_EVIDENCE_REQUIRED' }),
    ]));
  });
});
