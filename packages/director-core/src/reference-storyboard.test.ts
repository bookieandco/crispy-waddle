import { describe, expect, it } from 'vitest';
import {
  compileReferenceStoryboardShotList,
  validateReferenceStoryboard,
  validateReferenceStoryboardDeliverables,
  type ReferenceStoryboardBoard,
  type ReferenceStoryboardFrame,
} from './reference-storyboard.js';

const board: ReferenceStoryboardBoard = {
  id: 'board:ref:1',
  projectId: 'film:1',
  title: 'Night market framing references',
  frameIds: ['frame:1', 'frame:2'],
  version: 3,
  authority: 'DIRECTOR_REFERENCE_BOARD',
};

const frames: ReferenceStoryboardFrame[] = [
  {
    id: 'frame:1',
    projectId: 'film:1',
    sourceAssetId: 'clip:reference',
    sourceSha256: 'sha:clip',
    sourceKind: 'video-frame',
    sourceTimeSeconds: 3.2,
    extractedStillAssetId: 'still:1',
    extractedStillSha256: 'sha:still:1',
    label: 'Hero enters',
    crop: { x: 0.1, y: 0, width: 0.8, height: 1, aspectRatio: '16:9' },
    holdSeconds: 1.5,
    annotations: [{
      id: 'a1',
      kind: 'camera-move',
      text: 'slow push toward subject',
      points: [{ x: 0.2, y: 0.6 }, { x: 0.55, y: 0.5 }],
    }],
    promptText: 'Low wide night-market entrance, subject entering from frame right.',
    promptEvidenceIds: ['evidence:vision:1'],
    evidenceIds: ['evidence:frame:1'],
  },
  {
    id: 'frame:2',
    projectId: 'film:1',
    sourceAssetId: 'image:reference',
    sourceSha256: 'sha:image',
    sourceKind: 'image',
    extractedStillAssetId: 'still:2',
    extractedStillSha256: 'sha:still:2',
    label: 'Reaction',
    crop: { x: 0, y: 0.1, width: 1, height: 0.8, aspectRatio: '16:9' },
    holdSeconds: 2,
    annotations: [],
    evidenceIds: ['evidence:frame:2'],
  },
];

describe('reference storyboard', () => {
  it('compiles ordered source framing into an animatic-aware shot list', () => {
    const result = compileReferenceStoryboardShotList(board, frames);
    expect(result).toContain('SHOT 1 0-1.5s');
    expect(result).toContain('SHOT 2 1.5-3.5s');
    expect(result).toContain('slow push toward subject');
    expect(result).toContain('Reference-derived prompt');
  });

  it('rejects destructive or out-of-bounds crops', () => {
    const invalid = [{ ...frames[0]!, crop: { x: 0.8, y: 0, width: 0.4, height: 1 } }, frames[1]!];
    const issues = validateReferenceStoryboard(board, invalid);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REFERENCE_CROP_INVALID' }),
    ]));
  });

  it('requires evidence for vision-derived prompts', () => {
    const invalid = [{ ...frames[0]!, promptEvidenceIds: [] }, frames[1]!];
    const issues = validateReferenceStoryboard(board, invalid);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REFERENCE_PROMPT_EVIDENCE_REQUIRED' }),
    ]));
  });

  it('marks exports stale when they do not match the current board version', () => {
    const reasons = validateReferenceStoryboardDeliverables(board, [{
      kind: 'animatic',
      assetId: 'animatic:1',
      sha256: 'sha:animatic',
      generatedFromBoardVersion: 2,
      evidenceIds: ['evidence:render'],
    }]);
    expect(reasons).toContain('DIRECTOR_REFERENCE_DELIVERABLE_STALE:animatic');
  });
});
