import { describe, expect, it } from 'vitest';
import {
  buildStoryboardBatches,
  evaluateContinuityQc,
  planContinuityStrategy,
  validateCharacterIdentitySheet,
  type CharacterIdentitySheet,
  type ContinuityShotRequest,
} from './continuity-reference-strategy.js';

function marySheet(): CharacterIdentitySheet {
  return {
    id: 'sheet:mary:winter',
    projectId: 'movie-1',
    characterId: 'mary',
    continuityRef: 'character:mary:v1',
    appearanceVariantId: 'mary-winter',
    appearanceKind: 'wardrobe',
    parentSheetId: 'sheet:mary:base',
    canonicalFacePanelId: 'mary-face',
    panels: [
      {
        id: 'mary-face',
        assetId: 'asset:mary-face',
        sha256: 'sha-face',
        kind: 'face-close-up',
        faceVisible: true,
        neutralBackground: true,
        neutralLighting: true,
        evidenceIds: ['qa:face'],
      },
      {
        id: 'mary-body-front',
        assetId: 'asset:mary-body-front',
        sha256: 'sha-front',
        kind: 'body-front',
        faceVisible: false,
        neutralBackground: true,
        neutralLighting: true,
        scaleGroup: 'body-a',
        evidenceIds: ['qa:front'],
      },
      {
        id: 'mary-body-back',
        assetId: 'asset:mary-body-back',
        sha256: 'sha-back',
        kind: 'body-back',
        faceVisible: false,
        neutralBackground: true,
        neutralLighting: true,
        scaleGroup: 'body-a',
        evidenceIds: ['qa:back'],
      },
    ],
    identityTraits: ['freckles', 'white hair streak', 'eyebrow scar'],
    silhouetteTraits: ['chin-length bob', 'heavy knee-length coat'],
    colorTraits: ['dark coat', 'white hair streak'],
    version: 2,
    approvedAt: '2026-09-23T00:00:00Z',
    approvedBy: 'owner',
  };
}

function request(): ContinuityShotRequest {
  return {
    id: 'continuity:shot-12',
    projectId: 'movie-1',
    shotId: 'shot-12',
    characterSheets: [marySheet()],
    voiceReferences: [{
      characterId: 'mary',
      voiceIdentityId: 'voice:mary',
      assetId: 'asset:mary-voice-black-video',
      media: 'video',
      transport: 'black-video-wrapper',
      evidenceIds: ['voice:qa:mary'],
    }],
    environmentPack: {
      id: 'env:hangar',
      projectId: 'movie-1',
      environmentId: 'hangar',
      canonicalAssetId: 'asset:hangar-front',
      views: [
        {
          id: 'hangar-front',
          assetId: 'asset:hangar-front',
          sha256: 'sha-env-front',
          viewLabel: 'front wide',
          source: 'authored',
          parentAssetIds: [],
          evidenceIds: ['env:front'],
        },
        {
          id: 'hangar-rear',
          assetId: 'asset:hangar-rear',
          sha256: 'sha-env-rear',
          viewLabel: 'reverse wide',
          source: 'burst-extracted',
          parentAssetIds: ['asset:hangar-front'],
          evidenceIds: ['burst:frame:rear'],
        },
      ],
      version: 1,
    },
    firstFrameAssetId: 'asset:shot-12-first',
    lastFrameAssetId: 'asset:shot-12-last',
    styleReferenceAssetIds: ['asset:style'],
    priorShotReferenceAssetIds: ['asset:shot-11-approved-frame'],
    storyboardFrameIds: ['sb1','sb2','sb3','sb4','sb5','sb6','sb7','sb8','sb9'],
    targetEnvironmentAngles: ['front','rear','left','right'],
    dialogueCharacterIds: ['mary'],
    motionScale: 'large',
    preserveEnvironment: true,
    exactCompositionControl: true,
  };
}

describe('Director continuity reference strategy', () => {
  it('accepts one canonical face and faceless body panels', () => {
    expect(validateCharacterIdentitySheet(marySheet())).toEqual([]);
  });

  it('rejects competing faces on body panels', () => {
    const invalid = marySheet();
    invalid.panels = invalid.panels.map((panel) =>
      panel.id === 'mary-body-front' ? { ...panel, faceVisible: true } : panel,
    );
    expect(validateCharacterIdentitySheet(invalid)).toEqual(expect.arrayContaining([
      'DIRECTOR_CONTINUITY_SINGLE_FACE_ANCHOR_REQUIRED',
      'DIRECTOR_CONTINUITY_BODY_PANEL_FACE_CONFLICT:mary-body-front',
    ]));
  });

  it('requires style variants to carry identity through silhouette and color', () => {
    const invalid = marySheet();
    invalid.appearanceKind = 'style';
    invalid.silhouetteTraits = [];
    invalid.colorTraits = [];
    expect(validateCharacterIdentitySheet(invalid)).toContain(
      'DIRECTOR_CONTINUITY_STYLE_CARRY_TRAITS_REQUIRED',
    );
  });

  it('chooses layered continuity controls for a large-motion dialogue shot', () => {
    const plan = planContinuityStrategy(request());
    expect(plan.reasons).toEqual([]);
    expect(plan.techniques).toEqual(expect.arrayContaining([
      'identity-sheet',
      'voice-lock',
      'environment-elements',
      'burst-angle-pack',
      'storyboard-batch',
      'start-end-frames',
      'chained-references',
    ]));
    expect(plan.singleContinuousShot).toBe(true);
    expect(plan.storyboardBatches.map((batch) => batch.frameIds.length)).toEqual([4, 4, 1]);
    expect(plan.referenceManifest.references.map((reference) => reference.role)).toEqual(expect.arrayContaining([
      'character-identity',
      'audio',
      'location',
      'first-frame',
      'last-frame',
      'composition',
      'style',
    ]));
  });

  it('requires both start and end frames for large motion', () => {
    const invalid = request();
    invalid.lastFrameAssetId = undefined;
    expect(planContinuityStrategy(invalid).reasons).toContain(
      'DIRECTOR_CONTINUITY_LAST_FRAME_REQUIRED_FOR_LARGE_MOTION',
    );
  });

  it('requires burst-extracted environment views when many angles are requested', () => {
    const invalid = request();
    invalid.environmentPack = {
      ...invalid.environmentPack!,
      views: invalid.environmentPack!.views.map((view) => ({ ...view, source: 'authored' as const })),
    };
    expect(planContinuityStrategy(invalid).reasons).toContain(
      'DIRECTOR_CONTINUITY_BURST_VIEW_PACK_REQUIRED',
    );
  });

  it('caps continuity storyboard batches at four panels', () => {
    expect(buildStoryboardBatches(['1','2','3','4','5','6','7','8','9']).map((batch) => batch.frameIds.length))
      .toEqual([4, 4, 1]);
    expect(() => buildStoryboardBatches(['1','2'], 5)).toThrow(
      'DIRECTOR_CONTINUITY_STORYBOARD_BATCH_LIMIT_INVALID',
    );
  });

  it('keeps continuity perception advisory and Director authoritative', () => {
    const decision = evaluateContinuityQc([
      { dimension: 'face-identity', score: 0.95, confidence: 0.9, evidenceIds: ['vision:face'] },
      { dimension: 'environment', score: 0.68, confidence: 0.88, evidenceIds: ['vision:environment'] },
    ], ['face-identity', 'environment'], 0.8, 0.6);

    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_CONTINUITY_QC_SCORE_LOW:environment');
    expect(decision.authority).toBe('DIRECTOR_CONTINUITY_QC');
  });
});
